import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sers_citizen/data/report_store.dart';
import 'package:sers_citizen/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets('guest home has emergency actions and no account screens', (
    tester,
  ) async {
    final store = ReportStore();
    await tester.pumpWidget(SersApp(store: store));
    await tester.pumpAndSettle();
    expect(find.text('Road accident'), findsOneWidget);
    expect(find.text('Fire outbreak'), findsOneWidget);
    expect(find.text('My reports'), findsOneWidget);
    expect(find.text('Sign in'), findsNothing);
    expect(find.text('Profile'), findsNothing);
    expect(find.text('Settings'), findsNothing);
    await tester.tap(find.text('My reports'));
    await tester.pumpAndSettle();
    expect(find.text('No reports yet'), findsOneWidget);
    expect(find.text('Restore report'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    store.dispose();
  });
  test(
    'retry preserves the same report id and key after a network failure',
    () async {
      final calls = <Map<String, dynamic>>[];
      var attempt = 0;
      final store = ReportStore(
        client: MockClient((request) async {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          calls.add(body);
          if (attempt++ == 0) throw http.ClientException('offline');
          return http.Response(
            jsonEncode({
              'report': {
                ...body['report'],
                'reference': 'SERS-TEST',
                'status': 'Pending',
                'reportedAt': DateTime.now().toUtc().toIso8601String(),
                'assigned': false,
              },
            }),
            200,
          );
        }),
      );
      await store.initialize();
      final report = await store.prepare({
        'category': roadCategory,
        'title': 'Test road report',
        'description': 'A disposable unit test report',
        'location': 'Test location',
        'latitude': .32,
        'longitude': 32.58,
      });
      await expectLater(store.send(report), throwsA(isA<ReportFailure>()));
      expect(report.pending, isNotNull);
      await store.send(report);
      expect(calls[0]['report']['id'], calls[1]['report']['id']);
      expect(calls[0]['accessKey'], calls[1]['accessKey']);
      expect(report.pending, isNull);
      expect(store.reports.length, 1);
      final reloaded = ReportStore();
      await reloaded.initialize();
      expect(reloaded.reports.single.id, report.id);
      expect(reloaded.reports.single.trackingCode, report.trackingCode);
      store.dispose();
      reloaded.dispose();
    },
  );
  test(
    'status changes become unread and restoring requires the private key',
    () async {
      final store = ReportStore(
        client: MockClient(
          (request) async => http.Response(
            jsonEncode({
              'report': {
                'id': '00000000-0000-4000-a000-000000000001',
                'title': 'Test fire',
                'category': fireCategory,
                'reference': 'SERS-TEST',
                'status': 'Responding',
                'assigned': true,
                'reportedAt': DateTime.now().toUtc().toIso8601String(),
              },
            }),
            200,
          ),
        ),
      );
      await store.initialize();
      final report = SavedReport(
        id: '00000000-0000-4000-a000-000000000001',
        accessKey: List.filled(64, 'a').join(),
        data: {'status': 'Pending', 'assigned': false},
      );
      store.reports.add(report);
      await store.refresh(report);
      expect(store.unread, 1);
      await store.refresh(report, markRead: true);
      expect(store.unread, 0);
      await expectLater(
        store.restore('SERS-TEST'),
        throwsA(isA<ReportFailure>()),
      );
      store.dispose();
    },
  );
}
