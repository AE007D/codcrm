"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "fr" | "ar" | "en";

const T: Record<Lang, Record<string, string>> = {
  fr: {
    // Sidebar
    tagline: "Commandez. Expédiez. Encaissez.",
    notifications: "Notifications",
    all_up_to_date: "Tout est à jour ✓",
    n_pending: "en attente",
    to_confirm: "À confirmer",
    to_ship: "À expédier",
    no_pending_orders: "Aucune commande en attente",
    view_all_orders: "Voir toutes les commandes →",
    menu: "Menu",
    sound_on: "Son activé",
    sound_off: "Son désactivé",
    logging_out: "Déconnexion…",
    log_out: "Se déconnecter",
    role_admin: "Admin",
    role_agent: "Agent",
    role_viewer: "Viewer",
    language: "Langue",

    // Nav
    nav_dashboard: "Dashboard",
    nav_orders: "Commandes",
    nav_payments: "Paiements",
    nav_checkouts: "Abandons Checkout",
    nav_clients: "Clients",
    nav_products: "Produits",
    nav_boutiques: "Boutiques",
    nav_team: "Équipe",
    nav_finances: "Finances",
    nav_calculator: "Calculateur",
    nav_transit: "En Transit",
    nav_visitors: "Visiteurs live",
    nav_ads: "Ads Manager",
    nav_telegram: "Telegram",
    nav_integrations: "Intégrations",
    nav_reports: "Rapports",

    // Statuses
    status_nouveau: "Nouveau",
    status_confirme: "Confirmé",
    status_expedie: "Expédié",
    status_livre: "Livré",
    status_retourne: "Retourné",
    status_annule: "Annulé",
    status_injoignable: "Injoignable",
    status_fausse: "Fausse commande",

    // Common
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    search: "Rechercher…",
    add: "Ajouter",
    edit: "Modifier",
    close: "Fermer",
    confirm: "Confirmer",
    loading: "Chargement…",
    sending: "Envoi…",
    today: "Aujourd'hui",
    week: "7 jours",
    month: "30 jours",
    all: "Tout",
    show: "Afficher",
    hide: "Masquer",

    // Orders page
    orders_title: "Commandes",
    orders_subtitle: "Gestion des commandes clients",
    new_order: "+ Nouvelle commande",
    ship_order: "Expédier",
    ship_via_eagle: "Expédier via Eagle Express",
    tracking_number: "Numéro de suivi",
    customer_name: "Nom du client",
    phone: "Téléphone",
    city: "Ville",
    address: "Adresse",
    product: "Produit",
    quantity: "Quantité",
    price: "Prix (MAD)",
    notes: "Notes",
    no_orders: "Aucune commande",
    sync_eagle: "Sync Eagle",

    // Finances page
    finances_title: "Finances",
    finances_subtitle: "Investissement · Revenus · Bénéfice net",
    revenue: "Chiffre d'affaires",
    total_invested: "Total investi",
    net_profit: "Bénéfice net",
    profit_per_day: "Bénéfice / jour",
    cost_breakdown: "Détail des coûts",
    orders_summary: "Résumé commandes",
    modify_costs: "Modifier coûts",
    telegram_report: "Rapport Telegram",

    // Integrations
    integrations_title: "Intégrations",
    integrations_subtitle: "Connectez vos outils",

    // Login
    welcome_back: "Bon retour 👋",
    sign_in_subtitle: "Connectez-vous à votre espace CRM",
    create_account: "Créer votre compte",
    create_subtitle: "Commencez gratuitement, sans carte bancaire",
    email: "Adresse email",
    password: "Mot de passe",
    sign_in: "Se connecter",
    signing_in: "Connexion…",
    creating: "Création en cours…",
    no_account: "Pas encore de compte ?",
    create_free: "Créer un compte gratuit",
    already_account: "Déjà un compte ?",
    full_name: "Nom complet",
    store_name: "Nom de la boutique",
    confirm_password: "Confirmer le mot de passe",
    create_my_account: "Créer mon compte →",
    or_with_email: "ou avec email",
    pw_weak: "Faible",
    pw_medium: "Moyen",
    pw_good: "Bon",
    pw_strong: "Fort",

    // Products page
    products_title: "Produits",
    products_subtitle: "Catalogue et prix",

    // Clients page
    clients_title: "Clients",
    clients_subtitle: "Base clients",

    // Rapports page
    reports_title: "Rapports",
    reports_subtitle: "Statistiques & exports",
  },

  ar: {
    // Sidebar
    tagline: "اطلب. أرسل. اقبض.",
    notifications: "الإشعارات",
    all_up_to_date: "كل شيء محدّث ✓",
    n_pending: "في الانتظار",
    to_confirm: "للتأكيد",
    to_ship: "للإرسال",
    no_pending_orders: "لا توجد طلبات معلّقة",
    view_all_orders: "عرض كل الطلبات →",
    menu: "القائمة",
    sound_on: "الصوت مفعّل",
    sound_off: "الصوت معطّل",
    logging_out: "جاري الخروج…",
    log_out: "تسجيل الخروج",
    role_admin: "مدير",
    role_agent: "وكيل",
    role_viewer: "مشاهد",
    language: "اللغة",

    // Nav
    nav_dashboard: "لوحة التحكم",
    nav_orders: "الطلبات",
    nav_payments: "المدفوعات",
    nav_checkouts: "السلات المهجورة",
    nav_clients: "العملاء",
    nav_products: "المنتجات",
    nav_boutiques: "المتاجر",
    nav_team: "الفريق",
    nav_finances: "المالية",
    nav_calculator: "الحاسبة",
    nav_transit: "في الطريق",
    nav_visitors: "الزوار المباشر",
    nav_ads: "مدير الإعلانات",
    nav_telegram: "تيليغرام",
    nav_integrations: "التكاملات",
    nav_reports: "التقارير",

    // Statuses
    status_nouveau: "جديد",
    status_confirme: "مؤكد",
    status_expedie: "مُرسل",
    status_livre: "تم التسليم",
    status_retourne: "مُرجَع",
    status_annule: "ملغى",
    status_injoignable: "لا يرد",
    status_fausse: "طلب مزيف",

    // Common
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    search: "بحث…",
    add: "إضافة",
    edit: "تعديل",
    close: "إغلاق",
    confirm: "تأكيد",
    loading: "جاري التحميل…",
    sending: "جاري الإرسال…",
    today: "اليوم",
    week: "7 أيام",
    month: "30 يوماً",
    all: "الكل",
    show: "إظهار",
    hide: "إخفاء",

    // Orders page
    orders_title: "الطلبات",
    orders_subtitle: "إدارة طلبات العملاء",
    new_order: "+ طلب جديد",
    ship_order: "إرسال",
    ship_via_eagle: "الإرسال عبر Eagle Express",
    tracking_number: "رقم التتبع",
    customer_name: "اسم العميل",
    phone: "الهاتف",
    city: "المدينة",
    address: "العنوان",
    product: "المنتج",
    quantity: "الكمية",
    price: "السعر (درهم)",
    notes: "ملاحظات",
    no_orders: "لا توجد طلبات",
    sync_eagle: "مزامنة Eagle",

    // Finances page
    finances_title: "المالية",
    finances_subtitle: "الاستثمار · الإيرادات · الربح الصافي",
    revenue: "رقم الأعمال",
    total_invested: "إجمالي الاستثمار",
    net_profit: "الربح الصافي",
    profit_per_day: "الربح / يوم",
    cost_breakdown: "تفصيل التكاليف",
    orders_summary: "ملخص الطلبات",
    modify_costs: "تعديل التكاليف",
    telegram_report: "تقرير تيليغرام",

    // Integrations
    integrations_title: "التكاملات",
    integrations_subtitle: "اربط أدواتك",

    // Login
    welcome_back: "مرحباً بعودتك 👋",
    sign_in_subtitle: "سجّل الدخول إلى حسابك",
    create_account: "إنشاء حساب",
    create_subtitle: "ابدأ مجاناً، بدون بطاقة بنكية",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    sign_in: "تسجيل الدخول",
    signing_in: "جاري الدخول…",
    creating: "جاري الإنشاء…",
    no_account: "ليس لديك حساب؟",
    create_free: "إنشاء حساب مجاني",
    already_account: "لديك حساب بالفعل؟",
    full_name: "الاسم الكامل",
    store_name: "اسم المتجر",
    confirm_password: "تأكيد كلمة المرور",
    create_my_account: "إنشاء حسابي →",
    or_with_email: "أو بالبريد الإلكتروني",
    pw_weak: "ضعيف",
    pw_medium: "متوسط",
    pw_good: "جيد",
    pw_strong: "قوي",

    // Products page
    products_title: "المنتجات",
    products_subtitle: "الكتالوج والأسعار",

    // Clients page
    clients_title: "العملاء",
    clients_subtitle: "قاعدة العملاء",

    // Rapports page
    reports_title: "التقارير",
    reports_subtitle: "إحصائيات وتصديرات",
  },

  en: {
    // Sidebar
    tagline: "Order. Ship. Collect.",
    notifications: "Notifications",
    all_up_to_date: "All up to date ✓",
    n_pending: "pending",
    to_confirm: "To confirm",
    to_ship: "To ship",
    no_pending_orders: "No pending orders",
    view_all_orders: "View all orders →",
    menu: "Menu",
    sound_on: "Sound on",
    sound_off: "Sound off",
    logging_out: "Logging out…",
    log_out: "Log out",
    role_admin: "Admin",
    role_agent: "Agent",
    role_viewer: "Viewer",
    language: "Language",

    // Nav
    nav_dashboard: "Dashboard",
    nav_orders: "Orders",
    nav_payments: "Payments",
    nav_checkouts: "Abandoned Checkouts",
    nav_clients: "Clients",
    nav_products: "Products",
    nav_boutiques: "Stores",
    nav_team: "Team",
    nav_finances: "Finances",
    nav_calculator: "Calculator",
    nav_transit: "In Transit",
    nav_visitors: "Live Visitors",
    nav_ads: "Ads Manager",
    nav_telegram: "Telegram",
    nav_integrations: "Integrations",
    nav_reports: "Reports",

    // Statuses
    status_nouveau: "New",
    status_confirme: "Confirmed",
    status_expedie: "Shipped",
    status_livre: "Delivered",
    status_retourne: "Returned",
    status_annule: "Cancelled",
    status_injoignable: "Unreachable",
    status_fausse: "Fake order",

    // Common
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    search: "Search…",
    add: "Add",
    edit: "Edit",
    close: "Close",
    confirm: "Confirm",
    loading: "Loading…",
    sending: "Sending…",
    today: "Today",
    week: "7 days",
    month: "30 days",
    all: "All",
    show: "Show",
    hide: "Hide",

    // Orders page
    orders_title: "Orders",
    orders_subtitle: "Customer order management",
    new_order: "+ New order",
    ship_order: "Ship",
    ship_via_eagle: "Ship via Eagle Express",
    tracking_number: "Tracking number",
    customer_name: "Customer name",
    phone: "Phone",
    city: "City",
    address: "Address",
    product: "Product",
    quantity: "Quantity",
    price: "Price (MAD)",
    notes: "Notes",
    no_orders: "No orders",
    sync_eagle: "Sync Eagle",

    // Finances page
    finances_title: "Finances",
    finances_subtitle: "Investment · Revenue · Net profit",
    revenue: "Revenue",
    total_invested: "Total invested",
    net_profit: "Net profit",
    profit_per_day: "Profit / day",
    cost_breakdown: "Cost breakdown",
    orders_summary: "Orders summary",
    modify_costs: "Edit costs",
    telegram_report: "Telegram report",

    // Integrations
    integrations_title: "Integrations",
    integrations_subtitle: "Connect your tools",

    // Login
    welcome_back: "Welcome back 👋",
    sign_in_subtitle: "Sign in to your CRM workspace",
    create_account: "Create your account",
    create_subtitle: "Start for free, no credit card needed",
    email: "Email address",
    password: "Password",
    sign_in: "Sign in",
    signing_in: "Signing in…",
    creating: "Creating…",
    no_account: "Don't have an account?",
    create_free: "Create a free account",
    already_account: "Already have an account?",
    full_name: "Full name",
    store_name: "Store name",
    confirm_password: "Confirm password",
    create_my_account: "Create my account →",
    or_with_email: "or with email",
    pw_weak: "Weak",
    pw_medium: "Medium",
    pw_good: "Good",
    pw_strong: "Strong",

    // Products page
    products_title: "Products",
    products_subtitle: "Catalog & pricing",

    // Clients page
    clients_title: "Clients",
    clients_subtitle: "Client database",

    // Rapports page
    reports_title: "Reports",
    reports_subtitle: "Stats & exports",
  },
};

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LangContext = createContext<LangCtx>({
  lang: "fr",
  setLang: () => {},
  t: (k) => k,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const stored = localStorage.getItem("codcrm_lang") as Lang | null;
    if (stored && (stored === "fr" || stored === "ar" || stored === "en")) {
      setLangState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("codcrm_lang", lang);
  }, [lang]);

  function t(key: string): string {
    return T[lang]?.[key] ?? T.fr[key] ?? key;
  }

  return (
    <LangContext.Provider value={{ lang, setLang: setLangState, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
