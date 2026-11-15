import 'dart:async';
import 'package:flutter/material.dart';
import 'data/report_store.dart';
import 'screens/home.dart';
import 'screens/reports.dart';
import 'screens/report_form.dart';
import 'screens/tracking.dart';
import 'widgets/common.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(SersApp(store: ReportStore()));
}

class SersApp extends StatefulWidget {
  final ReportStore store;
  const SersApp({super.key, required this.store});
  @override
  State<SersApp> createState() => _SersAppState();
}

class _SersAppState extends State<SersApp> with WidgetsBindingObserver {
  int tab = 0;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(
      widget.store.initialize().then((_) {
        if (mounted) unawaited(widget.store.refreshAll());
      }),
    );
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        unawaited(widget.store.refreshAll());
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(widget.store.refreshAll());
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'SERS · Community',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: accent,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: paper,
      fontFamily: 'SersSans',
      appBarTheme: const AppBarTheme(
        backgroundColor: paper,
        foregroundColor: ink,
        elevation: 0,
        centerTitle: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: line),
        ),
        contentPadding: const EdgeInsets.all(16),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
    ),
    builder: (context, child) => ColoredBox(
      color: const Color(0xFFE7EBF0),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: child!,
        ),
      ),
    ),
    home: AnimatedBuilder(
      animation: widget.store,
      builder: (context, _) {
        final store = widget.store;
        if (!store.ready) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return Scaffold(
          appBar: AppBar(
            title: const Brand(),
            actions: [
              IconButton(
                tooltip: 'About this project',
                onPressed: () => showHelp(context),
                icon: const Icon(Icons.info_outline_rounded),
              ),
              const SizedBox(width: 10),
            ],
          ),
          body: IndexedStack(
            index: tab,
            children: [
              HomePage(
                store: store,
                onReport: (category) => openForm(context, category),
                onReports: () => setState(() => tab = 1),
              ),
              ReportsPage(
                store: store,
                onOpen: (report) => openTracking(context, report),
                updatesOnly: false,
              ),
              ReportsPage(
                store: store,
                onOpen: (report) => openTracking(context, report),
                updatesOnly: true,
              ),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            backgroundColor: Colors.white,
            indicatorColor: const Color(0xFFFFE5E4),
            onDestinationSelected: (i) => setState(() => tab = i),
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              const NavigationDestination(
                icon: Icon(Icons.receipt_long_outlined),
                label: 'My reports',
              ),
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: store.unread > 0,
                  label: Text('${store.unread}'),
                  child: const Icon(Icons.notifications_none_rounded),
                ),
                label: 'Updates',
              ),
            ],
          ),
        );
      },
    ),
  );
  Future<void> openForm(BuildContext context, String category) async {
    final report = await Navigator.of(context).push<SavedReport>(
      MaterialPageRoute(
        builder: (_) =>
            ReportForm(store: widget.store, initialCategory: category),
      ),
    );
    if (report != null && context.mounted) {
      await openTracking(context, report, justSent: true);
    }
  }

  Future<void> openTracking(
    BuildContext context,
    SavedReport report, {
    bool justSent = false,
  }) => Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) =>
          TrackingPage(store: widget.store, report: report, justSent: justSent),
    ),
  );
}
