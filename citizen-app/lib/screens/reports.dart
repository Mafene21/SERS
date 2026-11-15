import 'package:flutter/material.dart';
import '../data/report_store.dart';
import '../widgets/common.dart';

class ReportsPage extends StatelessWidget {
  final ReportStore store;
  final void Function(SavedReport) onOpen;
  final bool updatesOnly;
  const ReportsPage({
    super.key,
    required this.store,
    required this.onOpen,
    required this.updatesOnly,
  });
  @override
  Widget build(BuildContext context) {
    final reports = updatesOnly
        ? store.reports.where((r) => r.unread).toList()
        : store.reports;
    return RefreshIndicator(
      onRefresh: store.refreshAll,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            updatesOnly ? 'Your updates' : 'My reports',
            style: const TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            updatesOnly
                ? 'New response updates for reports saved on this device.'
                : 'Private report history saved on this device.',
            style: const TextStyle(color: muted, height: 1.5),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: store.refreshing ? null : store.refreshAll,
                icon: const Icon(Icons.refresh, size: 18),
                label: Text(store.refreshing ? 'Checking…' : 'Refresh'),
              ),
              const Spacer(),
              if (!updatesOnly)
                TextButton.icon(
                  onPressed: () => _restore(context),
                  icon: const Icon(Icons.key_rounded, size: 17),
                  label: const Text('Restore report'),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (store.error != null) MessageBox(store.error!, error: true),
          if (reports.isEmpty)
            Surface(
              child: Column(
                children: [
                  const SizedBox(height: 20),
                  Icon(
                    updatesOnly
                        ? Icons.notifications_none
                        : Icons.receipt_long_outlined,
                    size: 52,
                    color: muted,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    updatesOnly ? 'You’re all caught up' : 'No reports yet',
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    updatesOnly
                        ? 'Updates will appear here when your report changes. Keep the app open and connected.'
                        : 'Your submitted reports will appear here. You can also restore a report with its private tracking code.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: muted, height: 1.6),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          for (final report in reports)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => onOpen(report),
                child: Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            report.category == roadCategory
                                ? Icons.car_crash_outlined
                                : Icons.local_fire_department_outlined,
                            color: accent,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              report.reference,
                              style: const TextStyle(
                                fontSize: 12,
                                color: muted,
                              ),
                            ),
                          ),
                          if (report.unread) const Badge(),
                          const SizedBox(width: 8),
                          const Icon(Icons.chevron_right, color: muted),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        report.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 12,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          StatusPill(report.status, assigned: report.assigned),
                          Text(
                            shortDate(report.reportedAt.toLocal()),
                            style: const TextStyle(color: muted, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 12),
          const Text(
            'Keep your tracking codes private. Clearing app or browser data removes this history. A saved tracking code lets you restore a report.',
            style: TextStyle(color: muted, fontSize: 12, height: 1.6),
          ),
        ],
      ),
    );
  }

  Future<void> _restore(BuildContext context) async {
    final code = TextEditingController();
    String? error;
    bool busy = false;
    final report = await showDialog<SavedReport>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: const Text('Restore a report'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Paste your private tracking code to view this report on this device.',
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: code,
                  obscureText: true,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: const InputDecoration(
                    labelText: 'Private tracking code',
                  ),
                ),
                if (error != null) MessageBox(error!, error: true),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      update(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        final report = await store.restore(code.text);
                        if (dialogContext.mounted) {
                          Navigator.pop(dialogContext, report);
                        }
                      } catch (e) {
                        update(() {
                          busy = false;
                          error = e.toString();
                        });
                      }
                    },
              child: Text(busy ? 'Checking…' : 'Restore'),
            ),
          ],
        ),
      ),
    );
    code.dispose();
    if (report != null) onOpen(report);
  }
}
