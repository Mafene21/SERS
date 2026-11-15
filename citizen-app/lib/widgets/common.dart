import 'package:flutter/material.dart';

const accent = Color(0xFFD84343);
const ink = Color(0xFF172438);
const muted = Color(0xFF667489);
const paper = Color(0xFFF7F8FB);
const line = Color(0xFFE5E9EF);

class Brand extends StatelessWidget {
  const Brand({super.key});
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: accent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(
          Icons.health_and_safety_rounded,
          color: Colors.white,
          size: 26,
        ),
      ),
      const SizedBox(width: 10),
      const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'SERS',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.5,
            ),
          ),
          Text(
            'COMMUNITY',
            style: TextStyle(fontSize: 9, color: muted, letterSpacing: 2),
          ),
        ],
      ),
    ],
  );
}

class Surface extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.color = Colors.white,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: line),
    ),
    child: child,
  );
}

class Eyebrow extends StatelessWidget {
  final String text;
  const Eyebrow(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: const TextStyle(
      color: muted,
      fontSize: 11,
      fontWeight: FontWeight.w800,
      letterSpacing: 1.5,
    ),
  );
}

class MessageBox extends StatelessWidget {
  final String text;
  final bool error;
  const MessageBox(this.text, {super.key, this.error = false});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(vertical: 10),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: error ? const Color(0xFFFFEAE9) : const Color(0xFFEFF3F9),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          error ? Icons.error_outline : Icons.info_outline,
          size: 19,
          color: error ? accent : muted,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: error ? const Color(0xFF9F2929) : muted,
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ),
      ],
    ),
  );
}

Color statusColor(String status) => switch (status) {
  'Resolved' => const Color(0xFF16826B),
  'Responding' => const Color(0xFF3374C1),
  'Accepted' => const Color(0xFF875BB5),
  'Cancelled' => muted,
  'Unconfirmed' => accent,
  _ => const Color(0xFFAD741B),
};
String displayStatus(String status, bool assigned) => status == 'Pending'
    ? (assigned ? 'Responder assigned' : 'Report received')
    : status == 'Accepted'
    ? 'Responder accepted'
    : status == 'Unconfirmed'
    ? 'Not yet confirmed'
    : status;

class StatusPill extends StatelessWidget {
  final String status;
  final bool assigned;
  const StatusPill(this.status, {super.key, this.assigned = false});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: statusColor(status).withValues(alpha: .10),
      borderRadius: BorderRadius.circular(30),
    ),
    child: Text(
      displayStatus(status, assigned),
      style: TextStyle(
        color: statusColor(status),
        fontSize: 12,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

String shortDate(DateTime at) =>
    '${at.day}/${at.month}/${at.year} · ${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
void showHelp(BuildContext context) => showModalBottomSheet<void>(
  context: context,
  showDragHandle: true,
  isScrollControlled: true,
  builder: (_) => const SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(24, 4, 24, 28),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'About SERS Community',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
            SizedBox(height: 14),
            Text(
              'Report road accidents and fire outbreaks to the SERS project response team. No account is needed.',
              style: TextStyle(height: 1.6),
            ),
            MessageBox(
              'University project prototype. This app is not connected to public emergency services and is not a monitored emergency hotline.',
            ),
            Text(
              'Your privacy',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            SizedBox(height: 8),
            Text(
              'Reports and optional contact details are shared with authorized SERS staff. Your report history and private tracking codes are saved on this device. Anyone with a tracking code can view that report. Keep it private. Clearing app or browser data removes your local history; you can restore a report using its saved code.',
              style: TextStyle(color: muted, height: 1.6),
            ),
            SizedBox(height: 16),
            Text(
              'Updates appear while the app is open and connected. There are no SMS or phone push notifications in this version.',
              style: TextStyle(color: muted, height: 1.6),
            ),
          ],
        ),
      ),
    ),
  ),
);
