import 'package:flutter/material.dart';

void main() {
  runApp(const PuftApp());
}

class PuftApp extends StatelessWidget {
  const PuftApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PUFT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F766E),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF6F7F4),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class TransactionEntry {
  const TransactionEntry({
    required this.id,
    required this.amount,
    required this.description,
    required this.category,
    required this.merchant,
    required this.date,
    required this.isIncome,
  });

  final int id;
  final double amount;
  final String description;
  final String category;
  final String merchant;
  final DateTime date;
  final bool isIncome;
}

class ParsedEntry {
  const ParsedEntry({
    required this.amount,
    required this.description,
    required this.category,
    required this.merchant,
    required this.isIncome,
  });

  final double amount;
  final String description;
  final String category;
  final String merchant;
  final bool isIncome;
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _quickEntryController = TextEditingController();
  final List<TransactionEntry> _transactions = [
    TransactionEntry(
      id: 1,
      amount: 250,
      description: 'Lunch at Swiggy',
      category: 'Food',
      merchant: 'Swiggy',
      date: DateTime.now().subtract(const Duration(hours: 2)),
      isIncome: false,
    ),
    TransactionEntry(
      id: 2,
      amount: 800,
      description: 'Petrol',
      category: 'Transport',
      merchant: 'Fuel',
      date: DateTime.now().subtract(const Duration(days: 1)),
      isIncome: false,
    ),
    TransactionEntry(
      id: 3,
      amount: 50000,
      description: 'Salary',
      category: 'Income',
      merchant: 'Employer',
      date: DateTime.now().subtract(const Duration(days: 3)),
      isIncome: true,
    ),
  ];

  int _nextId = 4;

  @override
  void dispose() {
    _quickEntryController.dispose();
    super.dispose();
  }

  void _saveQuickEntry() {
    final parsed = _parseQuickEntry(_quickEntryController.text);
    if (parsed == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Try: 250 lunch, petrol 800, or earned 50000 salary'),
        ),
      );
      return;
    }

    setState(() {
      _transactions.insert(
        0,
        TransactionEntry(
          id: _nextId++,
          amount: parsed.amount,
          description: parsed.description,
          category: parsed.category,
          merchant: parsed.merchant,
          date: DateTime.now(),
          isIncome: parsed.isIncome,
        ),
      );
      _quickEntryController.clear();
    });
  }

  ParsedEntry? _parseQuickEntry(String rawInput) {
    final input = rawInput.trim();
    if (input.isEmpty) {
      return null;
    }

    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)').firstMatch(input);
    if (amountMatch == null) {
      return null;
    }

    final amount = double.tryParse(amountMatch.group(1)!);
    if (amount == null || amount <= 0) {
      return null;
    }

    final description = input.replaceFirst(amountMatch.group(0)!, '').trim();
    final normalizedDescription = description.isEmpty
        ? 'Quick entry'
        : _titleCase(description);
    final lowerInput = input.toLowerCase();
    final isIncome =
        lowerInput.contains('earned') ||
        lowerInput.contains('salary') ||
        lowerInput.contains('income') ||
        lowerInput.contains('paid me');

    return ParsedEntry(
      amount: amount,
      description: normalizedDescription,
      category: isIncome ? 'Income' : _suggestCategory(lowerInput),
      merchant: _suggestMerchant(lowerInput, normalizedDescription, isIncome),
      isIncome: isIncome,
    );
  }

  String _suggestCategory(String lowerInput) {
    const categoryRules = <String, List<String>>{
      'Food': [
        'lunch',
        'dinner',
        'breakfast',
        'coffee',
        'swiggy',
        'zomato',
        'restaurant',
      ],
      'Groceries': [
        'grocery',
        'groceries',
        'dmart',
        'bigbasket',
        'zepto',
        'blinkit',
      ],
      'Transport': ['petrol', 'fuel', 'uber', 'ola', 'cab', 'metro', 'bus'],
      'Housing': ['rent', 'maintenance'],
      'Utilities': [
        'electricity',
        'water',
        'wifi',
        'internet',
        'mobile',
        'recharge',
      ],
      'Shopping': ['amazon', 'flipkart', 'clothes', 'shopping'],
      'Subscriptions': ['netflix', 'spotify', 'prime', 'subscription'],
    };

    for (final rule in categoryRules.entries) {
      if (rule.value.any(lowerInput.contains)) {
        return rule.key;
      }
    }

    return 'General';
  }

  String _suggestMerchant(
    String lowerInput,
    String description,
    bool isIncome,
  ) {
    if (isIncome) {
      return 'Income';
    }

    const merchants = [
      'swiggy',
      'zomato',
      'dmart',
      'bigbasket',
      'zepto',
      'blinkit',
      'uber',
      'ola',
      'netflix',
    ];
    for (final merchant in merchants) {
      if (lowerInput.contains(merchant)) {
        return _titleCase(merchant);
      }
    }

    final words = description
        .split(RegExp(r'\s+'))
        .where((word) => word.length > 2)
        .toList();
    return words.isEmpty ? 'Manual' : words.first;
  }

  double get _monthIncome {
    return _transactions
        .where((entry) => entry.isIncome && _isCurrentMonth(entry.date))
        .fold(0, (total, entry) => total + entry.amount);
  }

  double get _monthSpend {
    return _transactions
        .where((entry) => !entry.isIncome && _isCurrentMonth(entry.date))
        .fold(0, (total, entry) => total + entry.amount);
  }

  double get _todaySpend {
    final now = DateTime.now();
    return _transactions
        .where(
          (entry) =>
              !entry.isIncome &&
              entry.date.year == now.year &&
              entry.date.month == now.month &&
              entry.date.day == now.day,
        )
        .fold(0, (total, entry) => total + entry.amount);
  }

  bool _isCurrentMonth(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 850;
            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
                    child: _Header(
                      monthSpend: _monthSpend,
                      netCashflow: _monthIncome - _monthSpend,
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                    child: _QuickEntryBar(
                      controller: _quickEntryController,
                      onSubmit: _saveQuickEntry,
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: isWide
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                flex: 6,
                                child: _DashboardPanel(
                                  monthSpend: _monthSpend,
                                  monthIncome: _monthIncome,
                                  todaySpend: _todaySpend,
                                  transactions: _transactions,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                flex: 5,
                                child: _RecentTransactions(
                                  transactions: _transactions,
                                ),
                              ),
                            ],
                          )
                        : Column(
                            children: [
                              _DashboardPanel(
                                monthSpend: _monthSpend,
                                monthIncome: _monthIncome,
                                todaySpend: _todaySpend,
                                transactions: _transactions,
                              ),
                              const SizedBox(height: 16),
                              _RecentTransactions(transactions: _transactions),
                            ],
                          ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 28)),
              ],
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => FocusScope.of(context).requestFocus(FocusNode()),
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
        icon: const Icon(Icons.bolt),
        label: const Text('5 sec log'),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.monthSpend, required this.netCashflow});

  final double monthSpend;
  final double netCashflow;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: colorScheme.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.account_balance_wallet,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PUFT',
                    style: textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Every rupee tracked in under 5 seconds',
                    style: textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          'This month: ${formatMoney(monthSpend)} spent',
          style: textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Net cashflow ${formatMoney(netCashflow)}',
          style: textTheme.titleMedium?.copyWith(
            color: netCashflow >= 0
                ? const Color(0xFF0F766E)
                : colorScheme.error,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _QuickEntryBar extends StatelessWidget {
  const _QuickEntryBar({required this.controller, required this.onSubmit});

  final TextEditingController controller;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 0,
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            const SizedBox(width: 8),
            const Icon(Icons.flash_on, color: Color(0xFF0F766E)),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => onSubmit(),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  hintText:
                      'Try "250 lunch", "petrol 800", or "earned 50000 salary"',
                ),
              ),
            ),
            FilledButton.icon(
              onPressed: onSubmit,
              icon: const Icon(Icons.add),
              label: const Text('Log'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardPanel extends StatelessWidget {
  const _DashboardPanel({
    required this.monthSpend,
    required this.monthIncome,
    required this.todaySpend,
    required this.transactions,
  });

  final double monthSpend;
  final double monthIncome;
  final double todaySpend;
  final List<TransactionEntry> transactions;

  @override
  Widget build(BuildContext context) {
    final categories = _categoryTotals(transactions);
    final topCategory = categories.entries.isEmpty
        ? 'None'
        : categories.entries.reduce((a, b) => a.value >= b.value ? a : b).key;

    return Column(
      children: [
        GridView.count(
          crossAxisCount: MediaQuery.sizeOf(context).width >= 560 ? 3 : 1,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: MediaQuery.sizeOf(context).width >= 560
              ? 1.45
              : 3.5,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            _MetricTile(
              label: 'Today spent',
              value: formatMoney(todaySpend),
              icon: Icons.today,
              color: const Color(0xFF2563EB),
            ),
            _MetricTile(
              label: 'Month income',
              value: formatMoney(monthIncome),
              icon: Icons.trending_up,
              color: const Color(0xFF0F766E),
            ),
            _MetricTile(
              label: 'Top category',
              value: topCategory,
              icon: Icons.pie_chart,
              color: const Color(0xFFB45309),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _InsightPanel(monthSpend: monthSpend, monthIncome: monthIncome),
        const SizedBox(height: 16),
        _CategoryBreakdown(categories: categories),
      ],
    );
  }

  Map<String, double> _categoryTotals(List<TransactionEntry> entries) {
    final totals = <String, double>{};
    for (final entry in entries.where((entry) => !entry.isIncome)) {
      totals.update(
        entry.category,
        (value) => value + entry.amount,
        ifAbsent: () => entry.amount,
      );
    }
    return totals;
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE4E7DF)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InsightPanel extends StatelessWidget {
  const _InsightPanel({required this.monthSpend, required this.monthIncome});

  final double monthSpend;
  final double monthIncome;

  @override
  Widget build(BuildContext context) {
    final savingsRate = monthIncome == 0
        ? 0
        : ((monthIncome - monthSpend) / monthIncome * 100).clamp(0, 100);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF102A27),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, color: Color(0xFFA7F3D0)),
              const SizedBox(width: 8),
              Text(
                'Smart nudge',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            savingsRate >= 20
                ? 'You are holding a ${savingsRate.toStringAsFixed(0)}% savings rate this month. Keep quick logging tight and this becomes a real habit.'
                : 'Your savings rate is ${savingsRate.toStringAsFixed(0)}%. Start with food, transport, and subscriptions before adding complex budgets.',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: const Color(0xFFEFFDF7),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryBreakdown extends StatelessWidget {
  const _CategoryBreakdown({required this.categories});

  final Map<String, double> categories;

  @override
  Widget build(BuildContext context) {
    final total = categories.values.fold(0.0, (sum, value) => sum + value);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE4E7DF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Category pulse',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          if (categories.isEmpty)
            const Text('No expenses logged yet.')
          else
            ...categories.entries.map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(entry.key)),
                        Text(
                          formatMoney(entry.value),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    LinearProgressIndicator(
                      value: total == 0 ? 0 : entry.value / total,
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RecentTransactions extends StatelessWidget {
  const _RecentTransactions({required this.transactions});

  final List<TransactionEntry> transactions;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE4E7DF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Recent activity',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          ...transactions
              .take(8)
              .map(
                (entry) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: entry.isIncome
                        ? const Color(0xFFD1FAE5)
                        : const Color(0xFFE0F2FE),
                    child: Icon(
                      entry.isIncome ? Icons.south_west : Icons.north_east,
                      color: entry.isIncome
                          ? const Color(0xFF047857)
                          : const Color(0xFF0369A1),
                    ),
                  ),
                  title: Text(
                    entry.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    '${entry.category} - ${entry.merchant} - ${formatShortDate(entry.date)}',
                  ),
                  trailing: Text(
                    '${entry.isIncome ? '+' : '-'}${formatMoney(entry.amount)}',
                    style: TextStyle(
                      color: entry.isIncome
                          ? const Color(0xFF047857)
                          : const Color(0xFF111827),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

String formatMoney(double value) {
  final whole = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    final fromEnd = whole.length - i;
    buffer.write(whole[i]);
    if (fromEnd > 1 && fromEnd % 3 == 1) {
      buffer.write(',');
    }
  }
  return 'Rs ${buffer.toString()}';
}

String formatShortDate(DateTime date) {
  final now = DateTime.now();
  if (date.year == now.year && date.month == now.month && date.day == now.day) {
    return 'Today';
  }

  final yesterday = now.subtract(const Duration(days: 1));
  if (date.year == yesterday.year &&
      date.month == yesterday.month &&
      date.day == yesterday.day) {
    return 'Yesterday';
  }

  return '${date.day}/${date.month}/${date.year}';
}

String _titleCase(String value) {
  return value
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .map(
        (word) => '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}',
      )
      .join(' ');
}
