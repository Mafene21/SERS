import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/report_store.dart';
import '../widgets/common.dart';

class ReportForm extends StatefulWidget {
  final ReportStore store;
  final String initialCategory;
  const ReportForm({
    super.key,
    required this.store,
    required this.initialCategory,
  });
  @override
  State<ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<ReportForm> {
  final form = GlobalKey<FormState>();
  final title = TextEditingController();
  final description = TextEditingController();
  final location = TextEditingController();
  final name = TextEditingController();
  final phone = TextEditingController();
  final map = MapController();
  late String category;
  LatLng? point;
  Uint8List? photo;
  int step = 0;
  bool locating = false, sending = false;
  String? error;
  SavedReport? prepared;
  @override
  void initState() {
    super.initState();
    category = widget.initialCategory;
  }

  @override
  void dispose() {
    title.dispose();
    description.dispose();
    location.dispose();
    name.dispose();
    phone.dispose();
    map.dispose();
    super.dispose();
  }

  Future<void> locate() async {
    setState(() {
      locating = true;
      error = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const ReportFailure(
          'Location permission was not granted. You can select the incident location on the map instead.',
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      if (!mounted) return;
      final selected = LatLng(position.latitude, position.longitude);
      map.move(selected, 16);
      setState(() {
        point = selected;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e is ReportFailure
              ? e.message
              : 'Location could not be found. Check device location settings or tap the incident location on the map.';
        });
      }
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  Future<void> choosePhoto(ImageSource source) async {
    try {
      final image = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 80,
      );
      if (image == null) return;
      final bytes = await image.readAsBytes();
      if (bytes.length > 3145728) {
        throw const ReportFailure('Choose a photo smaller than 3 MB.');
      }
      if (mounted) {
        setState(() {
          photo = bytes;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => error = e is ReportFailure
              ? e.message
              : 'Photo selection is unavailable. You can continue without a photo.',
        );
      }
    }
  }

  Future<void> submit() async {
    if (sending) return;
    setState(() {
      sending = true;
      error = null;
    });
    try {
      prepared ??= await widget.store.prepare({
        'title': title.text.trim(),
        'category': category,
        'description': description.text.trim(),
        'location': location.text.trim(),
        'latitude': point!.latitude,
        'longitude': point!.longitude,
        'name': name.text.trim(),
        'phone': phone.text.trim(),
      });
      await widget.store.send(prepared!);
      String? photoError;
      if (photo != null) {
        try {
          await widget.store.attachPhoto(prepared!, photo!);
        } catch (e) {
          photoError = e.toString();
        }
      }
      if (!mounted) return;
      if (photoError != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(photoError),
            duration: const Duration(seconds: 8),
          ),
        );
      }
      Navigator.pop(context, prepared);
    } catch (e) {
      if (mounted) {
        setState(() {
          error =
              '${e.toString()} Retrying sends the same report, avoiding duplicates.';
          sending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !sending,
    child: Scaffold(
      appBar: AppBar(
        title: const Text(
          'Report an emergency',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 30),
        children: [
          Row(
            children: [
              for (int i = 0; i < 3; i++)
                Expanded(
                  child: Container(
                    height: 4,
                    margin: const EdgeInsets.only(right: 5),
                    decoration: BoxDecoration(
                      color: i <= step ? accent : line,
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Eyebrow(
            'Step ${step + 1} of 3 · ${['Location', 'Details', 'Review'][step]}',
          ),
          const SizedBox(height: 12),
          if (step == 0) ...[
            const Text(
              'Where is it happening?',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                color: ink,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Choose the incident location, even if you are somewhere else.',
              style: TextStyle(color: muted, height: 1.5),
            ),
            const SizedBox(height: 20),
            DropdownButtonFormField<String>(
              initialValue: category,
              decoration: const InputDecoration(labelText: 'Emergency type'),
              items: const [
                DropdownMenuItem(
                  value: roadCategory,
                  child: Text('Road Accident'),
                ),
                DropdownMenuItem(
                  value: fireCategory,
                  child: Text('Fire Outbreak'),
                ),
              ],
              onChanged: (v) => setState(() => category = v!),
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: locating ? null : locate,
              icon: locating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location),
              label: Text(
                locating ? 'Finding your location…' : 'Use my current location',
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 270,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: FlutterMap(
                  mapController: map,
                  options: MapOptions(
                    initialCenter: point ?? const LatLng(.3476, 32.5825),
                    initialZoom: 12,
                    onTap: (_, selected) => setState(() => point = selected),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.sers.sers_citizen',
                    ),
                    if (point != null)
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: point!,
                            width: 48,
                            height: 48,
                            alignment: Alignment.topCenter,
                            child: const Icon(
                              Icons.location_pin,
                              color: accent,
                              size: 45,
                            ),
                          ),
                        ],
                      ),
                    RichAttributionWidget(
                      attributions: [
                        TextSourceAttribution(
                          'OpenStreetMap contributors',
                          onTap: () => launchUrl(
                            Uri.parse(
                              'https://www.openstreetmap.org/copyright',
                            ),
                            mode: LaunchMode.externalApplication,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              point == null
                  ? 'Tap the map to select a location. The starting view is Kampala, not your detected location.'
                  : 'Selected: ${point!.latitude.toStringAsFixed(5)}, ${point!.longitude.toStringAsFixed(5)} · Tap again to adjust.',
              style: const TextStyle(fontSize: 12, color: muted, height: 1.5),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: location,
              maxLength: 150,
              decoration: const InputDecoration(
                labelText: 'Location or nearby landmark',
                hintText: 'e.g. Near Nakawa market, Jinja Road',
              ),
            ),
          ],
          if (step == 1)
            Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tell us what you see.',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'A few clear details help the team review your report.',
                    style: TextStyle(color: muted, height: 1.5),
                  ),
                  const SizedBox(height: 22),
                  TextFormField(
                    controller: title,
                    maxLength: 100,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Short title',
                      hintText: 'e.g. Two vehicles involved in a collision',
                    ),
                    validator: (s) => (s?.trim().length ?? 0) < 5
                        ? 'Use at least 5 characters.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: description,
                    maxLength: 2000,
                    minLines: 4,
                    maxLines: 7,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'What happened?',
                      alignLabelWithHint: true,
                      hintText:
                          'Describe the situation and any useful details.',
                    ),
                    validator: (s) => (s?.trim().length ?? 0) < 10
                        ? 'Use at least 10 characters.'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  const Eyebrow('Photo · optional'),
                  const SizedBox(height: 8),
                  if (photo != null) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.memory(
                        photo!,
                        height: 150,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () => setState(() => photo = null),
                      icon: const Icon(Icons.close, size: 16),
                      label: const Text('Remove photo'),
                    ),
                  ],
                  Wrap(
                    spacing: 10,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => choosePhoto(ImageSource.gallery),
                        icon: const Icon(Icons.add_photo_alternate_outlined),
                        label: const Text('Add photo'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => choosePhoto(ImageSource.camera),
                        icon: const Icon(Icons.camera_alt_outlined),
                        label: const Text('Camera'),
                      ),
                    ],
                  ),
                  const Text(
                    'JPEG, PNG or WebP · up to 3 MB. Only take a photo if it is safe.',
                    style: TextStyle(color: muted, fontSize: 12, height: 1.6),
                  ),
                  const SizedBox(height: 22),
                  const Eyebrow('Contact details · optional'),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: name,
                    maxLength: 60,
                    decoration: const InputDecoration(
                      labelText: 'Your name (optional)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: phone,
                    maxLength: 30,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Phone number (optional)',
                      hintText: 'A number the project team can contact',
                    ),
                    validator: (s) =>
                        s != null && !RegExp(r'^[+\d ()-]*$').hasMatch(s)
                        ? 'Enter a valid phone number.'
                        : null,
                  ),
                ],
              ),
            ),
          if (step == 2) ...[
            const Text(
              'Check your report.',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                color: ink,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Confirm the type and location before sending.',
              style: TextStyle(color: muted),
            ),
            const SizedBox(height: 18),
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        category == roadCategory
                            ? Icons.car_crash_outlined
                            : Icons.local_fire_department_outlined,
                        color: accent,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        category,
                        style: const TextStyle(
                          color: accent,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    title.text,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    description.text,
                    style: const TextStyle(color: muted, height: 1.6),
                  ),
                  const Divider(height: 32),
                  const Eyebrow('Location'),
                  const SizedBox(height: 8),
                  Text(location.text),
                  Text(
                    '${point!.latitude.toStringAsFixed(5)}, ${point!.longitude.toStringAsFixed(5)}',
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                  if (photo != null) ...[
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.memory(
                        photo!,
                        height: 150,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ],
                  if (name.text.isNotEmpty || phone.text.isNotEmpty) ...[
                    const Divider(height: 32),
                    const Eyebrow('Contact'),
                    const SizedBox(height: 8),
                    Text(
                      [
                        name.text,
                        phone.text,
                      ].where((s) => s.isNotEmpty).join(' · '),
                    ),
                  ],
                ],
              ),
            ),
            const MessageBox(
              'This sends your report to the SERS project team. It does not call public emergency services. A reference number confirms receipt.',
            ),
          ],
          if (error != null) MessageBox(error!, error: true),
          const SizedBox(height: 20),
          if (prepared != null && error != null)
            const Text(
              'Your original report details are kept for this retry.',
              style: TextStyle(color: muted, fontSize: 12),
            ),
          FilledButton.icon(
            onPressed: sending
                ? null
                : () {
                    if (step == 0) {
                      if (point == null || location.text.trim().length < 3) {
                        setState(
                          () => error =
                              'Select a location on the map and enter a nearby landmark.',
                        );
                        return;
                      }
                      setState(() {
                        step = 1;
                        error = null;
                      });
                    } else if (step == 1) {
                      if (form.currentState!.validate()) {
                        setState(() {
                          step = 2;
                          error = null;
                        });
                      }
                    } else {
                      submit();
                    }
                  },
            icon: sending
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    step == 2
                        ? Icons.send_rounded
                        : Icons.arrow_forward_rounded,
                  ),
            label: Text(
              sending
                  ? 'Sending your report…'
                  : step == 2
                  ? (prepared == null ? 'Send report' : 'Retry same report')
                  : 'Continue',
            ),
          ),
          if (step > 0)
            TextButton(
              onPressed: sending || prepared != null
                  ? null
                  : () => setState(() {
                      step--;
                      error = null;
                    }),
              child: const Text('Back'),
            ),
        ],
      ),
    ),
  );
}
