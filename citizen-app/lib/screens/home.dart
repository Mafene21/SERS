import 'package:flutter/material.dart';
import '../data/report_store.dart';
import '../widgets/common.dart';

class HomePage extends StatelessWidget {
  final ReportStore store;
  final void Function(String) onReport;
  final VoidCallback onReports;
  const HomePage({
    super.key,
    required this.store,
    required this.onReport,
    required this.onReports,
  });
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
    children: [
      const Row(
        children: [
          Icon(Icons.circle, size: 7, color: Color(0xFF16826B)),
          SizedBox(width: 7),
          Eyebrow('Here for your community'),
        ],
      ),
      const SizedBox(height: 16),
      const Text(
        'A clear report.\nA coordinated response.',
        style: TextStyle(
          fontSize: 35,
          height: 1.13,
          fontWeight: FontWeight.w900,
          letterSpacing: -1.2,
          color: ink,
        ),
      ),
      const SizedBox(height: 14),
      const Text(
        'Share what happened and where. Help your SERS response team understand the situation.',
        style: TextStyle(fontSize: 15, height: 1.6, color: muted),
      ),
      const SizedBox(height: 26),
      const Eyebrow('What are you reporting?'),
      const SizedBox(height: 12),
      _CategoryCard(
        title: 'Road accident',
        description: 'A collision or road incident',
        icon: Icons.car_crash_outlined,
        color: accent,
        onTap: () => onReport(roadCategory),
      ),
      const SizedBox(height: 12),
      _CategoryCard(
        title: 'Fire outbreak',
        description: 'A building, vehicle or other fire',
        icon: Icons.local_fire_department_outlined,
        color: const Color(0xFFB96C22),
        onTap: () => onReport(fireCategory),
      ),
      const SizedBox(height: 24),
      if (store.reports.isNotEmpty) ...[
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Eyebrow('Your latest report'),
            TextButton(onPressed: onReports, child: const Text('View reports')),
          ],
        ),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                store.reports.first.reference,
                style: const TextStyle(color: muted, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Text(
                store.reports.first.title,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              StatusPill(
                store.reports.first.status,
                assigned: store.reports.first.assigned,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
      ],
      const Eyebrow('Simple. Direct. No account needed.'),
      const SizedBox(height: 12),
      const Surface(
        child: Column(
          children: [
            _HowStep(
              '1',
              'Pin the location',
              'Use GPS or choose the location on a map.',
            ),
            SizedBox(height: 18),
            _HowStep(
              '2',
              'Share the details',
              'Describe what you can see. Add a photo if safe.',
            ),
            SizedBox(height: 18),
            _HowStep(
              '3',
              'Follow your report',
              'Keep your private code to check response updates.',
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      const MessageBox(
        'SERS is a university project prototype, not a public emergency hotline. Reports go to the project team.',
      ),
      if (store.error != null) MessageBox(store.error!, error: true),
    ],
  );
}

class _CategoryCard extends StatelessWidget {
  final String title, description;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _CategoryCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Report $title',
    child: Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: line),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                width: 58,
                height: 62,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .09),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Icon(icon, size: 35, color: color),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      description,
                      style: const TextStyle(fontSize: 12, color: muted),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_rounded, color: color, size: 23),
            ],
          ),
        ),
      ),
    ),
  );
}

class _HowStep extends StatelessWidget {
  final String number, title, detail;
  const _HowStep(this.number, this.title, this.detail);
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      CircleAvatar(
        radius: 15,
        backgroundColor: paper,
        child: Text(
          number,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            const SizedBox(height: 3),
            Text(
              detail,
              style: const TextStyle(color: muted, fontSize: 12, height: 1.5),
            ),
          ],
        ),
      ),
    ],
  );
}
