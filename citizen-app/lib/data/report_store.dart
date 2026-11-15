import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const citizenApi = String.fromEnvironment(
  'SERS_API_URL',
  defaultValue:
      'https://wtfjgpvyhkdfhqujlfdz.supabase.co/functions/v1/sers-citizen',
);
const roadCategory = 'Road Accident';
const fireCategory = 'Fire Outbreak';

String randomKey() => List.generate(
  32,
  (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0'),
).join();
String newId() {
  final h = randomKey();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-4${h.substring(13, 16)}-a${h.substring(17, 20)}-${h.substring(20, 32)}';
}

class ReportFailure implements Exception {
  final String message;
  const ReportFailure(this.message);
  @override
  String toString() => message;
}

class SavedReport {
  final String id;
  final String accessKey;
  Map<String, dynamic> data;
  Map<String, dynamic>? pending;
  bool unread;
  SavedReport({
    required this.id,
    required this.accessKey,
    required this.data,
    this.pending,
    this.unread = false,
  });
  String get title => data['title'] as String? ?? 'Emergency report';
  String get category => data['category'] as String? ?? roadCategory;
  String get status => data['status'] as String? ?? 'Unconfirmed';
  String get reference =>
      data['reference'] as String? ?? 'Awaiting confirmation';
  bool get assigned => data['assigned'] == true;
  bool get closed => status == 'Resolved' || status == 'Cancelled';
  String get trackingCode => '$id.$accessKey';
  DateTime get reportedAt =>
      DateTime.tryParse(data['reportedAt'] as String? ?? '') ?? DateTime.now();
  Map<String, dynamic> toJson() => {
    'id': id,
    'accessKey': accessKey,
    'data': data,
    'pending': pending,
    'unread': unread,
  };
  factory SavedReport.fromJson(Map<String, dynamic> json) {
    if (!RegExp(
      r'^[0-9a-f]{64}$',
    ).hasMatch(json['accessKey'] as String? ?? '')) {
      throw const FormatException('Invalid report');
    }
    return SavedReport(
      id: json['id'] as String,
      accessKey: json['accessKey'] as String,
      data: Map<String, dynamic>.from(json['data'] as Map),
      pending: json['pending'] == null
          ? null
          : Map<String, dynamic>.from(json['pending'] as Map),
      unread: json['unread'] == true,
    );
  }
}

class ReportStore extends ChangeNotifier {
  final http.Client client;
  final String endpoint;
  ReportStore({http.Client? client, this.endpoint = citizenApi})
    : client = client ?? http.Client();
  SharedPreferences? _preferences;
  String _deviceKey = '';
  final List<SavedReport> reports = [];
  bool ready = false;
  String? error;
  bool refreshing = false;
  int get unread => reports.where((r) => r.unread).length;
  Future<void> initialize() async {
    try {
      _preferences = await SharedPreferences.getInstance();
      _deviceKey = _preferences!.getString('sers-device-key') ?? randomKey();
      if (!await _preferences!.setString('sers-device-key', _deviceKey)) {
        throw const ReportFailure(
          'This device could not save your private tracking information.',
        );
      }
      final raw = _preferences!.getString('sers-guest-reports');
      if (raw != null) {
        for (final value in jsonDecode(raw) as List) {
          reports.add(
            SavedReport.fromJson(Map<String, dynamic>.from(value as Map)),
          );
        }
      }
    } catch (_) {
      error =
          'Device storage is unavailable or its saved reports could not be read. Use a regular browser with storage enabled.';
    }
    ready = true;
    notifyListeners();
  }

  Future<void> _save() async {
    if (_preferences == null ||
        !await _preferences!.setString(
          'sers-guest-reports',
          jsonEncode(reports.map((r) => r.toJson()).toList()),
        )) {
      throw const ReportFailure(
        'Unable to save the private tracking code on this device.',
      );
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> _request(Map<String, dynamic> body) async {
    try {
      final response = await client
          .post(
            Uri.parse(endpoint),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 25));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ReportFailure(
          data['error'] as String? ??
              'Unable to complete this request. Please retry.',
        );
      }
      return data;
    } on ReportFailure {
      rethrow;
    } catch (_) {
      throw const ReportFailure(
        'Unable to confirm a connection. Check your internet and retry. A report is only received when a reference number appears.',
      );
    }
  }

  Future<SavedReport> prepare(Map<String, dynamic> payload) async {
    if (_preferences == null) {
      throw ReportFailure(error ?? 'Device storage is unavailable.');
    }
    if (reports.length >= 100) {
      throw const ReportFailure(
        'This device has reached its saved report limit. Keep your tracking codes before clearing browser data.',
      );
    }
    final id = newId();
    final report = SavedReport(
      id: id,
      accessKey: randomKey(),
      data: {
        ...payload,
        'status': 'Unconfirmed',
        'reportedAt': DateTime.now().toUtc().toIso8601String(),
      },
      pending: {...payload, 'id': id},
    );
    reports.insert(0, report);
    await _save();
    return report;
  }

  Future<void> send(SavedReport report) async {
    if (report.pending == null) return;
    final response = await _request({
      'action': 'submit',
      'deviceKey': _deviceKey,
      'accessKey': report.accessKey,
      'report': report.pending,
    });
    report.data = Map<String, dynamic>.from(response['report'] as Map);
    report.pending = null;
    await _save();
  }

  Future<void> attachPhoto(SavedReport report, Uint8List bytes) async {
    try {
      final response = await client
          .post(
            Uri.parse('$endpoint?action=photo'),
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-report-id': report.id,
              'x-access-key': report.accessKey,
            },
            body: bytes,
          )
          .timeout(const Duration(seconds: 35));
      if (response.statusCode != 200) {
        throw const ReportFailure(
          'Your report was received, but the photo could not be attached. You can retry it from this report.',
        );
      }
      await refresh(report);
    } on ReportFailure {
      rethrow;
    } catch (_) {
      throw const ReportFailure(
        'Your report was received. The photo connection failed; retry the photo from this report.',
      );
    }
  }

  Future<void> refresh(SavedReport report, {bool markRead = false}) async {
    final response = await _request({
      'action': 'track',
      'id': report.id,
      'accessKey': report.accessKey,
    });
    final next = Map<String, dynamic>.from(response['report'] as Map);
    final changed =
        report.data['status'] != next['status'] ||
        report.assigned != (next['assigned'] == true);
    report.data = next;
    report.pending = null;
    report.unread = markRead ? false : (report.unread || changed);
    await _save();
  }

  Future<void> refreshAll() async {
    if (refreshing || reports.isEmpty) return;
    refreshing = true;
    notifyListeners();
    try {
      for (final report in reports.take(30)) {
        await refresh(report);
      }
      error = null;
    } catch (e) {
      error = e.toString();
    }
    refreshing = false;
    notifyListeners();
  }

  Future<SavedReport> restore(String code) async {
    final match = RegExp(
      r'^([0-9a-f-]{36})\.([0-9a-f]{64})$',
    ).firstMatch(code.trim());
    if (match == null) {
      throw const ReportFailure('Paste the complete private tracking code.');
    }
    final id = match.group(1)!;
    final existing = reports.where((r) => r.id == id).firstOrNull;
    if (existing != null) {
      await refresh(existing, markRead: true);
      return existing;
    }
    final report = SavedReport(id: id, accessKey: match.group(2)!, data: {});
    final response = await _request({
      'action': 'track',
      'id': report.id,
      'accessKey': report.accessKey,
    });
    report.data = Map<String, dynamic>.from(response['report'] as Map);
    reports.insert(0, report);
    await _save();
    return report;
  }

  Future<void> markRead(SavedReport report) async {
    report.unread = false;
    await _save();
  }

  @override
  void dispose() {
    client.close();
    super.dispose();
  }
}
