import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:puft/main.dart';

void main() {
  testWidgets('quick entry logs a transaction and updates totals', (
    tester,
  ) async {
    await tester.pumpWidget(const PuftApp());

    expect(find.text('PUFT'), findsOneWidget);
    expect(find.textContaining('Every rupee tracked'), findsOneWidget);

    await tester.enterText(
      find.byType(EditableText),
      '1200 groceries at DMart',
    );
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    expect(find.text('Groceries At Dmart'), findsOneWidget);
    expect(find.textContaining('Rs 1,200'), findsWidgets);
  });
}
