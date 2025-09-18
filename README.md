# AiravatL Admin Portal

An admin dashboard for managing auctions, users, and consigners built with Next.js and Supabase.

## 🚀 Features

- **User Management**: View and manage user profiles
- **Auction Management**: Monitor and manage auction listings
- **Consigner Dashboard**: Track consigner activities and performance
- **Driver Management**: Oversee delivery driver information
- **Secure Authentication**: Admin-only access with role-based permissions
- **Responsive Design**: Modern UI with Tailwind CSS

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: GitHub Pages

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project

## ⚙️ Setup & Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/AiravatL/AiravatL-admin.git
   cd AiravatL-admin
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**

   Run the SQL script in your Supabase SQL Editor:

   ```bash
   # Execute admin_rls_policies.sql in Supabase dashboard
   ```

5. **Development Server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🗄️ Database Schema

The application expects the following Supabase tables:

- `admin_users` - Admin user profiles
- `profiles` - User profiles
- `auctions` - Auction listings
- `auction_bids` - Auction bids
- `auction_notifications` - Notifications
- `auction_audit_logs` - Audit trail

## 🔐 Authentication & Security

- Admin authentication via Supabase Auth
- Row Level Security (RLS) policies
- Admin-only access controls
- Secure environment variable handling

## 🚢 Deployment

### GitHub Pages (Current Setup)

This project is configured for GitHub Pages deployment with a static fallback:

1. **Automatic Deployment**: Pushes to `main` branch trigger deployment
2. **Manual Deployment**: Use GitHub Actions workflow dispatch
3. **Live Demo**: https://airavall.github.io/AiravatL-admin/

**Note**: The GitHub Pages deployment shows a configuration page since it requires Supabase environment variables to function as a full application.

### Local Development Deployment

For full functionality, run locally with proper environment variables:

```bash
# Clone and setup
git clone https://github.com/AiravatL/AiravatL-admin.git
cd AiravatL-admin
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auctions/          # Auction management
│   ├── consigners/        # Consigner dashboard
│   ├── dashboard/         # Main dashboard
│   ├── drivers/           # Driver management
│   ├── login/             # Authentication
│   └── users/             # User management
├── components/            # Reusable components
├── lib/                   # Utilities and configurations
│   ├── auth.ts           # Authentication helpers
│   └── supabase.ts       # Supabase client
└── middleware.ts          # Route protection
```

## 🔧 Development

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support, please contact the AiravatL team or create an issue in this repository.
