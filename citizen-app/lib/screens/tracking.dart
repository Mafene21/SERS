import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../data/report_store.dart';
import '../widgets/common.dart';

class TrackingPage extends StatefulWidget {
  final ReportStore store;
  final SavedReport report;
  final bool justSent;
  const TrackingPage({
    super.key,
    required this.store,
    required this.report,
    this.justSent = false,
  });
  @override
  State<TrackingPage> createState() => _TrackingPageState();
}

class _TrackingPageState extends State<TrackingPage> {
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    unawaited(refresh());
  }

  Future<void> refresh() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.store.refresh(widget.report, markRead: true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> retry() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.store.send(widget.report);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> attach() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 80,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      if (bytes.length > 3145728) {
        throw const ReportFailure('Choose a photo smaller than 3 MB.');
      }
      setState(() {
        busy = true;
        error = null;
      });
      await widget.store.attachPhoto(widget.report, bytes);
    } catch (e) {
      if (mounted) {
        setState(
          () => error = e is ReportFailure
              ? e.message
              : 'Photo selection is unavailable.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.store,
    builder: (context, _) {
      final r = widget.report;
      final d = r.data;
      final received = r.pending == null;
      final timeline = (d['timeline'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      final stage = r.status == 'Resolved'
          ? 4
          : r.status == 'Responding'
          ? 3
          : r.status == 'Accepted'
          ? 2
          : r.assigned
          ? 1
          : 0;
      return Scaffold(
        appBar: AppBar(
          title: Text(
            widget.justSent ? 'Your report' : 'Track report',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
        ),
        body: RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (widget.justSent && received) ...[
                const Align(
                  alignment: Alignment.centerLeft,
                  child: CircleAvatar(
                    radius: 30,
                    backgroundColor: Color(0xFFE1F3ED),
                    child: Icon(
                      Icons.check_rounded,
                      color: Color(0xFF16826B),
                      size: 36,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Your report was received.',
                  style: TextStyle(
                    fontSize: 29,
                    fontWeight: FontWeight.w900,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'The SERS project team can now review it. Check this page for updates.',
                  style: TextStyle(color: muted, height: 1.6),
                ),
                const SizedBox(height: 22),
              ],
              Surface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            r.reference,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: muted,
                            ),
                          ),
                        ),
                        if (busy)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        else
                          IconButton(
                            onPressed: refresh,
                            tooltip: 'Refresh report',
                            icon: const Icon(Icons.refresh),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      r.title,
                      style: const TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w800,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 14),
                    StatusPill(r.status, assigned: r.assigned),
                    const SizedBox(height: 18),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.location_on_outlined,
                          color: muted,
                          size: 19,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            d['location'] as String? ?? '',
                            style: const TextStyle(color: muted, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      shortDate(r.reportedAt.toLocal()),
                      style: const TextStyle(color: muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (error != null) MessageBox(error!, error: true),
              if (!received) ...[
                const MessageBox(
                  'Receipt has not been confirmed. Retry this same report to avoid sending a duplicate.',
                  error: true,
                ),
                FilledButton(
                  onPressed: busy ? null : retry,
                  child: const Text('Retry same report'),
                ),
              ],
              const SizedBox(height: 24),
              const Eyebrow('Response progress'),
              const SizedBox(height: 14),
              if (r.status == 'Cancelled')
                const MessageBox(
                  'This report was cancelled by the SERS team. No further response updates are expected.',
                )
              else
                Surface(
                  child: Column(
                    children: [
                      for (final entry in [
                        'Report received',
                        'Responder assigned',
                        'Responder accepted',
                        'Responding',
                        'Resolved',
                      ].indexed)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Row(
                            children: [
                              Container(
                                width: 29,
                                height: 29,
                                decoration: BoxDecoration(
                                  color: received && entry.$1 <= stage
                                      ? const Color(0xFF16826B)
                                      : paper,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  received && entry.$1 <= stage
                                      ? Icons.check_rounded
                                      : Icons.circle_outlined,
                                  size: 17,
                                  color: received && entry.$1 <= stage
                                      ? Colors.white
                                      : muted,
                                ),
                              ),
                              const SizedBox(width: 13),
                              Text(
                                entry.$2,
                                style: TextStyle(
                                  fontWeight: received && entry.$1 == stage
                                      ? FontWeight.w800
                                      : FontWeight.w500,
                                  color: received && entry.$1 <= stage
                                      ? ink
                                      : muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 24),
              const Eyebrow('Report details'),
              const SizedBox(height: 12),
              Surface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.category,
                      style: const TextStyle(
                        color: accent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      d['description'] as String? ?? '',
                      style: const TextStyle(color: muted, height: 1.6),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      d['latitude'] == null
                          ? 'Location awaiting confirmation'
                          : '${d['latitude']}, ${d['longitude']}',
                      style: const TextStyle(fontSize: 12, color: muted),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(
                          d['photoAttached'] == true
                              ? Icons.photo_outlined
                              : Icons.add_photo_alternate_outlined,
                          color: muted,
                          size: 19,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            d['photoAttached'] == true
                                ? 'Photo attached · shared privately with staff'
                                : 'No photo attached',
                            style: const TextStyle(color: muted, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                    if (received && !r.closed)
                      TextButton(
                        onPressed: busy ? null : attach,
                        child: Text(
                          d['photoAttached'] == true
                              ? 'Replace photo'
                              : 'Attach a photo',
                        ),
                      ),
                  ],
                ),
              ),
              if (timeline.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Eyebrow('Activity'),
                const SizedBox(height: 12),
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final event in timeline.reversed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.history_rounded,
                                size: 18,
                                color: muted,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      event['title'] as String,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      shortDate(
                                        DateTime.parse(
                                          event['at'] as String,
                                        ).toLocal(),
                                      ),
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: muted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
              const Eyebrow('Keep your private tracking code'),
              const SizedBox(height: 10),
              const Text(
                'Your reference number alone cannot open this report. Save the private code to restore it on another device. Share it only with someone you trust.',
                style: TextStyle(color: muted, fontSize: 13, height: 1.6),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () async {
                  try {
                    await Clipboard.setData(
                      ClipboardData(text: r.trackingCode),
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Private tracking code copied. Keep it safe.',
                          ),
                        ),
                      );
                    }
                  } catch (_) {
                    if (context.mounted) {
                      showDialog<void>(
                        context: context,
                        builder: (dialogContext) => AlertDialog(
                          title: const Text('Private tracking code'),
                          content: SelectableText(r.trackingCode),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(dialogContext),
                              child: const Text('Done'),
                            ),
                          ],
                        ),
                      );
                    }
                  }
                },
                icon: const Icon(Icons.copy_rounded, size: 18),
                label: const Text('Copy private tracking code'),
              ),
              const SizedBox(height: 16),
              const Text(
                'Checks for updates every 30 seconds while the app is open. You can also pull down to refresh.',
                style: TextStyle(color: muted, fontSize: 12, height: 1.6),
              ),
            ],
          ),
        ),
      );
    },
  );
}
