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
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF000000),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981),
          secondary: Color(0xFF2EC4B6),
          surface: Color(0xFF161616),
          onSurface: Colors.white,
        ),
        fontFamily: 'Inter',
        useMaterial3: true,
      ),
      home: const LoginScreen(),
    );
  }
}

// Data models
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

class TripEntry {
  const TripEntry({
    required this.id,
    required this.name,
    required this.dateRange,
    required this.spent,
    required this.budget,
    required this.imageUrl,
  });

  final int id;
  final String name;
  final String dateRange;
  final double spent;
  final double budget;
  final String imageUrl;
}

// 1. LOGIN SCREEN
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _signIn() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const MainShellScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Text(
                'Welcome Back',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Sign in to your personal finance tracker',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 48),
              TextField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: 'Email address',
                  filled: true,
                  fillColor: const Color(0xFF161616),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF222222)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF222222)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Password',
                  filled: true,
                  fillColor: const Color(0xFF161616),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF222222)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF222222)),
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                      color: Colors.grey,
                    ),
                    onPressed: () {
                      setState(() {
                        _obscurePassword = !_obscurePassword;
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {},
                  child: const Text(
                    'Forgot Password?',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Container(
                height: 54,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(27),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
                  ),
                ),
                child: ElevatedButton(
                  onPressed: _signIn,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(27),
                    ),
                  ),
                  child: const Text(
                    'Sign In',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: _signIn,
                icon: const Icon(Icons.g_mobiledata, size: 28),
                label: const Text('Sign in with Google'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: Color(0xFF222222)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _signIn,
                icon: const Icon(Icons.face, size: 22),
                label: const Text('Sign in with Face ID'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: Color(0xFF222222)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text("Don't have an account? "),
                  GestureDetector(
                    onTap: () {},
                    child: const Text(
                      'Create an account',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// 2. MAIN NAVIGATION SHELL
class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _selectedIndex = 0;

  // Shared state
  final List<TransactionEntry> _transactions = [
    TransactionEntry(
      id: 1,
      amount: 1200,
      description: 'Rent Payment',
      category: 'Housing',
      merchant: 'Landlord',
      date: DateTime.now().subtract(const Duration(days: 1)),
      isIncome: false,
    ),
    TransactionEntry(
      id: 2,
      amount: 150,
      description: 'Grocery Store',
      category: 'Food',
      merchant: 'Supermarket',
      date: DateTime.now().subtract(const Duration(days: 2)),
      isIncome: false,
    ),
    TransactionEntry(
      id: 3,
      amount: 10.99,
      description: 'Spotify Premium',
      category: 'Subscriptions',
      merchant: 'Spotify',
      date: DateTime.now().subtract(const Duration(days: 3)),
      isIncome: false,
    ),
    TransactionEntry(
      id: 4,
      amount: 4200,
      description: 'Monthly Salary',
      category: 'Income',
      merchant: 'Company Inc',
      date: DateTime.now().subtract(const Duration(days: 4)),
      isIncome: true,
    ),
  ];

  final List<TripEntry> _trips = [
    const TripEntry(
      id: 1,
      name: 'Summer in Italy',
      dateRange: 'Jun 15 - Jun 28, 2026',
      spent: 2450,
      budget: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1498503182468-3b51cbb6cb24?w=500&auto=format&fit=crop',
    ),
    const TripEntry(
      id: 2,
      name: 'Tokyo Business Trip',
      dateRange: 'Jul 8 - Jul 12, 2026',
      spent: 1200,
      budget: 1500,
      imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=500&auto=format&fit=crop',
    ),
    const TripEntry(
      id: 3,
      name: 'Weekend in NYC',
      dateRange: 'Aug 2 - Aug 4, 2026',
      spent: 350,
      budget: 1000,
      imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=500&auto=format&fit=crop',
    ),
  ];

  void _addTransaction(TransactionEntry tx) {
    setState(() {
      _transactions.insert(0, tx);
    });
  }

  void _updateTransaction(TransactionEntry oldTx, TransactionEntry newTx) {
    setState(() {
      final index = _transactions.indexOf(oldTx);
      if (index != -1) {
        _transactions[index] = newTx;
      }
    });
  }

  void _deleteTransaction(TransactionEntry tx) {
    setState(() {
      _transactions.remove(tx);
    });
  }

  void _updateTrip(TripEntry oldTrip, TripEntry newTrip) {
    setState(() {
      final index = _trips.indexOf(oldTrip);
      if (index != -1) {
        _trips[index] = newTrip;
      }
    });
  }

  void _deleteTrip(TripEntry trip) {
    setState(() {
      _trips.remove(trip);
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      DashboardScreen(transactions: _transactions),
      TripsScreen(
        trips: _trips,
        onUpdate: _updateTrip,
        onDelete: _deleteTrip,
      ),
      TransactionsScreen(
        transactions: _transactions,
        onAdd: _addTransaction,
        onUpdate: _updateTransaction,
        onDelete: _deleteTransaction,
      ),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        type: BottomNavigationBarType.fixed,
        backgroundColor: const Color(0xFF111111),
        selectedItemColor: const Color(0xFF10B981),
        unselectedItemColor: Colors.grey,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.explore_outlined),
            activeIcon: Icon(Icons.explore),
            label: 'Trips',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.swap_horiz_outlined),
            activeIcon: Icon(Icons.swap_horiz),
            label: 'Activity',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// 3. DASHBOARD SCREEN
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key, required this.transactions});
  final List<TransactionEntry> transactions;

  @override
  Widget build(BuildContext context) {

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Total Balance',
                        style: TextStyle(fontSize: 14, color: Colors.grey),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '\$15,450.25',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Text(
                      '+\$850.10 this month',
                      style: TextStyle(
                        color: Color(0xFF10B981),
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Sparkline Balance Trend Card
              Container(
                height: 160,
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF161616),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF222222)),
                ),
                child: CustomPaint(
                  painter: LineChartPainter([14100, 14600, 14200, 15100, 14800, 15450.25]),
                  child: Container(),
                ),
              ),
              const SizedBox(height: 24),

              // Monthly Overview
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Monthly Overview',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text(
                      'Show All',
                      style: TextStyle(color: Color(0xFF10B981)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Donut chart representation
                  SizedBox(
                    width: 110,
                    height: 110,
                    child: CustomPaint(
                      painter: DonutChartPainter(
                        [0.45, 0.25, 0.15, 0.10, 0.05],
                        const [
                          Color(0xFF10B981),
                          Color(0xFFF59E0B),
                          Color(0xFFEF4444),
                          Color(0xFF3B82F6),
                          Color(0xFF6B7280),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          'Spent',
                          style: TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  // Legend details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildLegendItem('Housing', '45%', const Color(0xFF10B981)),
                        _buildLegendItem('Food', '25%', const Color(0xFFF59E0B)),
                        _buildLegendItem('Entertainment', '15%', const Color(0xFFEF4444)),
                        _buildLegendItem('Transport', '10%', const Color(0xFF3B82F6)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Income vs Expenses visual indicator
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF161616),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Income', style: TextStyle(color: Colors.grey, fontSize: 13)),
                          const SizedBox(height: 4),
                          const Text('\$4,200', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
                          const SizedBox(height: 10),
                          Container(
                            height: 10,
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              borderRadius: BorderRadius.circular(5),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Expenses', style: TextStyle(color: Colors.grey, fontSize: 13)),
                          const SizedBox(height: 4),
                          const Text('\$2,800', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
                          const SizedBox(height: 10),
                          Container(
                            height: 10,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444),
                              borderRadius: BorderRadius.circular(5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Recent Transactions Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recent Transactions',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text(
                      'See All',
                      style: TextStyle(color: Color(0xFF10B981)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Render transactions
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: transactions.length > 3 ? 3 : transactions.length,
                itemBuilder: (context, index) {
                  final t = transactions[index];
                  IconData icon = Icons.payment;
                  Color iconColor = Colors.blue;
                  if (t.category == 'Housing') {
                    icon = Icons.home;
                    iconColor = Colors.green;
                  } else if (t.category == 'Food') {
                    icon = Icons.restaurant;
                    iconColor = Colors.orange;
                  } else if (t.category == 'Subscriptions') {
                    icon = Icons.audiotrack;
                    iconColor = Colors.red;
                  } else if (t.isIncome) {
                    icon = Icons.wallet;
                    iconColor = Colors.teal;
                  }

                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: iconColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, color: iconColor),
                    ),
                    title: Text(
                      t.description,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      '${t.category} - ${t.merchant}',
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                    trailing: Text(
                      '${t.isIncome ? '+' : '-'}\$${t.amount.toStringAsFixed(2)}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: t.isIncome ? const Color(0xFF10B981) : Colors.white,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLegendItem(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 12)),
            ],
          ),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
        ],
      ),
    );
  }
}

// 4. TRIPS SCREEN
class TripsScreen extends StatelessWidget {
  const TripsScreen({
    super.key,
    required this.trips,
    required this.onUpdate,
    required this.onDelete,
  });

  final List<TripEntry> trips;
  final Function(TripEntry, TripEntry) onUpdate;
  final Function(TripEntry) onDelete;

  void _showEditTripSheet(BuildContext context, TripEntry trip) {
    final nameController = TextEditingController(text: trip.name);
    final dateController = TextEditingController(text: trip.dateRange);
    final budgetController = TextEditingController(text: trip.budget.toString());

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161616),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Edit Trip',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Trip Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dateController,
                decoration: const InputDecoration(labelText: 'Date Range / Destination'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: budgetController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Budget'),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  final budget = double.tryParse(budgetController.text) ?? trip.budget;
                  final updated = TripEntry(
                    id: trip.id,
                    name: nameController.text.trim(),
                    dateRange: dateController.text.trim(),
                    spent: trip.spent,
                    budget: budget,
                    imageUrl: trip.imageUrl,
                  );
                  onUpdate(trip, updated);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () {
                  onDelete(trip);
                  Navigator.pop(context);
                },
                style: TextButton.styleFrom(
                  foregroundColor: Colors.redAccent,
                ),
                child: const Text('Delete Trip', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Trips',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
          ),
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        itemCount: trips.length,
        itemBuilder: (context, index) {
          final trip = trips[index];
          final progress = trip.spent / trip.budget;
          final remaining = trip.budget - trip.spent;

          return GestureDetector(
            onTap: () => _showEditTripSheet(context, trip),
            child: Card(
              margin: const EdgeInsets.only(bottom: 20),
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: Color(0xFF222222)),
              ),
              color: const Color(0xFF161616),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Cover Image
                  Container(
                    height: 140,
                    decoration: BoxDecoration(
                      image: DecorationImage(
                        image: NetworkImage(trip.imageUrl),
                        fit: BoxFit.cover,
                        onError: (exception, stackTrace) {},
                      ),
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [Colors.black.withValues(alpha: 0.8), Colors.transparent],
                        ),
                      ),
                      alignment: Alignment.bottomLeft,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            trip.name,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            trip.dateRange,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // Details
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Spent',
                              style: TextStyle(color: Colors.grey),
                            ),
                            Text(
                              '\$${trip.spent.round()} / \$${trip.budget.round()}',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(
                          value: progress,
                          minHeight: 8,
                          backgroundColor: const Color(0xFF222222),
                          color: progress > 1.0 ? Colors.red : const Color(0xFF10B981),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Remaining: \$${remaining.round()}',
                              style: TextStyle(
                                fontSize: 13,
                                color: remaining >= 0 ? const Color(0xFF10B981) : Colors.red,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// 5. TRANSACTIONS SCREEN (Quick Log & Ledger)
class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({
    super.key,
    required this.transactions,
    required this.onAdd,
    required this.onUpdate,
    required this.onDelete,
  });

  final List<TransactionEntry> transactions;
  final Function(TransactionEntry) onAdd;
  final Function(TransactionEntry, TransactionEntry) onUpdate;
  final Function(TransactionEntry) onDelete;

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  final TextEditingController _controller = TextEditingController();
  DateTime? _filterStartDate;
  DateTime? _filterEndDate;
  DateTime? _logDate;

  Future<void> _pickLogDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _logDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF10B981),
              onPrimary: Colors.black,
              surface: Color(0xFF161616),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _logDate = picked;
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<TransactionEntry> get _filteredTransactions {
    if (_filterStartDate == null && _filterEndDate == null) {
      return widget.transactions;
    }

    return widget.transactions.where((t) {
      final txDate = DateTime(t.date.year, t.date.month, t.date.day);
      
      final start = _filterStartDate != null 
          ? DateTime(_filterStartDate!.year, _filterStartDate!.month, _filterStartDate!.day)
          : null;
          
      final end = _filterEndDate != null 
          ? DateTime(_filterEndDate!.year, _filterEndDate!.month, _filterEndDate!.day)
          : null;

      if (start != null && end != null) {
        return txDate.isAfter(start.subtract(const Duration(seconds: 1))) && 
               txDate.isBefore(end.add(const Duration(days: 1)));
      } else if (start != null) {
        return txDate.isAtSameMomentAs(start);
      }
      return true;
    }).toList();
  }

  void _setPresetFilter(String preset) {
    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);

    setState(() {
      if (preset == 'all') {
        _filterStartDate = null;
        _filterEndDate = null;
      } else if (preset == 'today') {
        _filterStartDate = todayStart;
        _filterEndDate = todayStart;
      } else if (preset == 'yesterday') {
        _filterStartDate = todayStart.subtract(const Duration(days: 1));
        _filterEndDate = todayStart.subtract(const Duration(days: 1));
      } else if (preset == 'month') {
        _filterStartDate = DateTime(today.year, today.month, 1);
        _filterEndDate = todayStart;
      }
    });
  }

  Future<void> _pickDateRange() async {
    final initialDateRange = _filterStartDate != null && _filterEndDate != null
        ? DateTimeRange(start: _filterStartDate!, end: _filterEndDate!)
        : DateTimeRange(
            start: DateTime.now().subtract(const Duration(days: 7)),
            end: DateTime.now(),
          );

    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      initialDateRange: initialDateRange,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF10B981),
              onPrimary: Colors.black,
              surface: Color(0xFF161616),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _filterStartDate = picked.start;
        _filterEndDate = picked.end;
      });
    }
  }

  bool _isTodaySelected() {
    if (_filterStartDate == null || _filterEndDate == null) return false;
    final today = DateTime.now();
    return _filterStartDate!.year == today.year &&
        _filterStartDate!.month == today.month &&
        _filterStartDate!.day == today.day &&
        _filterEndDate!.year == today.year &&
        _filterEndDate!.month == today.month &&
        _filterEndDate!.day == today.day;
  }

  bool _isYesterdaySelected() {
    if (_filterStartDate == null || _filterEndDate == null) return false;
    final yesterday = DateTime.now().subtract(const Duration(days: 1));
    return _filterStartDate!.year == yesterday.year &&
        _filterStartDate!.month == yesterday.month &&
        _filterStartDate!.day == yesterday.day &&
        _filterEndDate!.year == yesterday.year &&
        _filterEndDate!.month == yesterday.month &&
        _filterEndDate!.day == yesterday.day;
  }

  bool _isThisMonthSelected() {
    if (_filterStartDate == null || _filterEndDate == null) return false;
    final today = DateTime.now();
    return _filterStartDate!.year == today.year &&
        _filterStartDate!.month == today.month &&
        _filterStartDate!.day == 1 &&
        _filterEndDate!.year == today.year &&
        _filterEndDate!.month == today.month &&
        _filterEndDate!.day == today.day;
  }

  String _monthName(int monthNum) {
    const names = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return names[monthNum];
  }

  Widget _buildPresetChip(String preset, String label) {
    final isActive = (preset == 'all' && _filterStartDate == null && _filterEndDate == null) ||
        (preset == 'today' && _isTodaySelected()) ||
        (preset == 'yesterday' && _isYesterdaySelected()) ||
        (preset == 'month' && _isThisMonthSelected());

    return ChoiceChip(
      label: Text(label),
      selected: isActive,
      onSelected: (_) => _setPresetFilter(preset),
      selectedColor: const Color(0xFF10B981),
      labelStyle: TextStyle(
        color: isActive ? Colors.black : Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: 12,
      ),
      backgroundColor: const Color(0xFF161616),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: isActive ? const Color(0xFF10B981) : const Color(0xFF222222)),
      ),
    );
  }

  void _submitLog() {
    final input = _controller.text.trim();
    if (input.isEmpty) return;

    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)').firstMatch(input);
    if (amountMatch == null) return;
    final amount = double.tryParse(amountMatch.group(1)!);
    if (amount == null) return;

    final desc = input.replaceFirst(amountMatch.group(0)!, '').trim();
    final description = desc.isEmpty ? 'Quick entry' : desc;

    final isIncome = input.toLowerCase().contains('earned') || input.toLowerCase().contains('salary');

    widget.onAdd(
      TransactionEntry(
        id: DateTime.now().millisecondsSinceEpoch,
        amount: amount,
        description: description,
        category: isIncome ? 'Income' : 'General',
        merchant: 'Manual Log',
        date: _logDate ?? DateTime.now(),
        isIncome: isIncome,
      ),
    );

    _controller.clear();
    setState(() {
      _logDate = null;
    });
  }

  void _showEditTransactionSheet(BuildContext context, TransactionEntry t) {
    final descController = TextEditingController(text: t.description);
    final amountController = TextEditingController(text: t.amount.toString());
    final categoryController = TextEditingController(text: t.category);
    final merchantController = TextEditingController(text: t.merchant);
    bool isIncome = t.isIncome;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161616),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                left: 20,
                right: 20,
                top: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Edit Transaction',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: descController,
                    decoration: const InputDecoration(labelText: 'Description'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Amount'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: categoryController,
                    decoration: const InputDecoration(labelText: 'Category'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: merchantController,
                    decoration: const InputDecoration(labelText: 'Merchant'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Is Income'),
                      Switch(
                        value: isIncome,
                        activeTrackColor: const Color(0xFF10B981),
                        onChanged: (val) {
                          setSheetState(() {
                            isIncome = val;
                          });
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () {
                      final amount = double.tryParse(amountController.text) ?? t.amount;
                      final updated = TransactionEntry(
                        id: t.id,
                        amount: amount,
                        description: descController.text.trim(),
                        category: categoryController.text.trim(),
                        merchant: merchantController.text.trim(),
                        date: t.date,
                        isIncome: isIncome,
                      );
                      widget.onUpdate(t, updated);
                      Navigator.pop(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () {
                      widget.onDelete(t);
                      Navigator.pop(context);
                    },
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.redAccent,
                    ),
                    child: const Text('Delete Transaction', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredTransactions;
    final totalSpend = filtered.where((t) => !t.isIncome).fold<double>(0, (sum, t) => sum + t.amount);
    final totalIncome = filtered.where((t) => t.isIncome).fold<double>(0, (sum, t) => sum + t.amount);
    final count = filtered.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Activity Ledger'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              Icons.calendar_month,
              color: (_filterStartDate != null) ? const Color(0xFF10B981) : Colors.white,
            ),
            onPressed: _pickDateRange,
          ),
          if (_filterStartDate != null || _filterEndDate != null)
            IconButton(
              icon: const Icon(Icons.clear_all, color: Colors.redAccent),
              onPressed: () {
                setState(() {
                  _filterStartDate = null;
                  _filterEndDate = null;
                });
              },
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Preset Chips
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildPresetChip('all', 'All Time'),
                    const SizedBox(width: 8),
                    _buildPresetChip('today', 'Today'),
                    const SizedBox(width: 8),
                    _buildPresetChip('yesterday', 'Yesterday'),
                    const SizedBox(width: 8),
                    _buildPresetChip('month', 'This Month'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            // Dynamic Analytics Summary Card
            if (_filterStartDate != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 4.0),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF161616),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF222222)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _filterEndDate == null || _filterStartDate == _filterEndDate
                            ? 'Showing: ${_filterStartDate!.day} ${_monthName(_filterStartDate!.month)}'
                            : 'Showing: ${_filterStartDate!.day} ${_monthName(_filterStartDate!.month)} - ${_filterEndDate!.day} ${_monthName(_filterEndDate!.month)}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Spend', style: TextStyle(fontSize: 11, color: Colors.grey)),
                              const SizedBox(height: 2),
                              Text('\$${totalSpend.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white)),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Earned', style: TextStyle(fontSize: 11, color: Colors.grey)),
                              const SizedBox(height: 2),
                              Text('\$${totalIncome.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF10B981))),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Entries', style: TextStyle(fontSize: 11, color: Colors.grey)),
                              const SizedBox(height: 2),
                              Text('$count', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.blue)),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            // Quick entry box
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF161616),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF222222)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.flash_on, color: Color(0xFF10B981)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        onSubmitted: (_) => _submitLog(),
                        decoration: const InputDecoration(
                          hintText: 'Try "250 lunch" or "earned 50000 salary"',
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add, color: Color(0xFF10B981)),
                      onPressed: _submitLog,
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final t = filtered[index];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    onTap: () => _showEditTransactionSheet(context, t),
                    title: Text(t.description, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${t.category} - ${t.merchant}'),
                    trailing: Text(
                      '${t.isIncome ? '+' : '-'}\$${t.amount.toStringAsFixed(2)}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: t.isIncome ? const Color(0xFF10B981) : Colors.white,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// 6. PROFILE / SETTINGS SCREEN
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20.0),
        children: [
          const Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: Color(0xFF222222),
                  child: Icon(Icons.person, size: 40, color: Colors.grey),
                ),
                SizedBox(height: 12),
                Text(
                  'Workspace Admin',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                Text(
                  'admin@puft.com',
                  style: TextStyle(color: Colors.grey, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 30),
          _buildSettingsTile(Icons.notifications_outlined, 'Notifications', 'Manage alerts & nudges'),
          _buildSettingsTile(Icons.lock_outline, 'Privacy & Security', 'Face ID and PIN setup'),
          _buildSettingsTile(Icons.currency_exchange, 'Default Currency', 'USD (\$)'),
          _buildSettingsTile(Icons.info_outline, 'About PUFT', 'v1.2.0 premium edition'),
          const SizedBox(height: 24),
          TextButton(
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (context) => const LoginScreen()),
              );
            },
            child: const Text('Logout Workspace', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTile(IconData icon, String title, String subtitle) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: const Color(0xFF161616),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: Colors.grey),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
    );
  }
}

// Custom painters for premium visuals
class LineChartPainter extends CustomPainter {
  LineChartPainter(this.points);
  final List<double> points;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    
    final paint = Paint()
      ..color = const Color(0xFF10B981)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;

    final fillPaint = Paint()
      ..style = PaintingStyle.fill
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF10B981).withValues(alpha: 0.25),
          const Color(0xFF10B981).withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final path = Path();
    final fillPath = Path();

    final stepX = size.width / (points.length - 1);
    final minVal = points.reduce((a, b) => a < b ? a : b);
    final maxVal = points.reduce((a, b) => a > b ? a : b);
    final range = maxVal - minVal == 0 ? 1 : maxVal - minVal;

    double getX(int idx) => idx * stepX;
    double getY(double val) => size.height - ((val - minVal) / range * (size.height * 0.7) + (size.height * 0.1));

    path.moveTo(getX(0), getY(points[0]));
    fillPath.moveTo(getX(0), size.height);
    fillPath.lineTo(getX(0), getY(points[0]));

    for (var i = 1; i < points.length; i++) {
      path.lineTo(getX(i), getY(points[i]));
      fillPath.lineTo(getX(i), getY(points[i]));
    }

    fillPath.lineTo(getX(points.length - 1), size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class DonutChartPainter extends CustomPainter {
  DonutChartPainter(this.percentages, this.colors);
  final List<double> percentages;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    final double radius = size.width / 2;
    final center = Offset(radius, radius);
    final rect = Rect.fromCircle(center: center, radius: radius - 6);
    
    double startAngle = -3.14 / 2; // start from top
    
    for (var i = 0; i < percentages.length; i++) {
      final sweepAngle = percentages[i] * 2 * 3.14159265;
      final paint = Paint()
        ..color = colors[i % colors.length]
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10.0
        ..strokeCap = StrokeCap.butt;
      
      canvas.drawArc(rect, startAngle, sweepAngle, false, paint);
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
