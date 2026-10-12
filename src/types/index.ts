export type UserRole = 'admin' | 'china_team' | 'kinshasa_team' | 'cashier' | 'client';

export type Currency = 'USD' | 'CNY' | 'CDF' | 'AOA';

export type TransportMode = 'MARITIME' | 'AERIEN';

export interface FreightRates {
  maritimePricePerKg: number; // historique : le maritime est désormais facturé au CBM
  maritimePricePerCbm: number; // Prix maritime par CBM (m³)
  aerienPricePerKg: number;
  freightRateCurrency: Currency;
}

export type ParcelStatus =
  | 'COMMANDE_CREEE'
  | 'ATTENTE_RECEPTION_CHINE'
  | 'RECU_CHINE'
  | 'IDENTIFIE'
  | 'CONTROLE'
  | 'PREPARE_EXPEDITION'
  | 'EXPEDITION_EN_PREPARATION'
  | 'EXPEDIE'
  | 'EN_TRANSIT'
  | 'ARRIVE_DESTINATION'
  | 'DEDOUANEMENT_TRAITEMENT'
  | 'DISPONIBLE_AGENCE'
  | 'PREPARATION_LIVRAISON'
  | 'EN_COURS_LIVRAISON'
  | 'LIVRE'
  | 'RETIRE_CLIENT'
  | 'ANOMALIE';

export interface ParcelStatusConfig {
  code: ParcelStatus;
  label: string;
  stepNumber: number;
  badgeClass: string;
  category: 'CHINE' | 'TRANSIT' | 'DESTINATION' | 'CLOTURE' | 'PROBLEME';
  description: string;
}

export const PARCEL_STATUSES: Record<ParcelStatus, ParcelStatusConfig> = {
  COMMANDE_CREEE: {
    code: 'COMMANDE_CREEE',
    label: '1. Commande créée',
    stepNumber: 1,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    category: 'CHINE',
    description: 'La commande a été initiée et enregistrée dans le système.',
  },
  ATTENTE_RECEPTION_CHINE: {
    code: 'ATTENTE_RECEPTION_CHINE',
    label: '2. En attente de réception en Chine',
    stepNumber: 2,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    category: 'CHINE',
    description: 'En attente de livraison par le fournisseur à l’entrepôt en Chine.',
  },
  RECU_CHINE: {
    code: 'RECU_CHINE',
    label: '3. Colis reçu en Chine',
    stepNumber: 3,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    category: 'CHINE',
    description: 'Colis réceptionné avec succès à l’entrepôt GZ MUBUA en Chine.',
  },
  IDENTIFIE: {
    code: 'IDENTIFIE',
    label: '4. Colis identifié',
    stepNumber: 4,
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    category: 'CHINE',
    description: 'Étiquetage et attribution du code unique de suivi.',
  },
  CONTROLE: {
    code: 'CONTROLE',
    label: '5. Colis contrôlé',
    stepNumber: 5,
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
    category: 'CHINE',
    description: 'Poids, dimensions, état extérieur et conformité vérifiés.',
  },
  PREPARE_EXPEDITION: {
    code: 'PREPARE_EXPEDITION',
    label: '6. Colis préparé pour expédition',
    stepNumber: 6,
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    category: 'CHINE',
    description: 'Emballage consolidé et prêt pour chargement.',
  },
  EXPEDITION_EN_PREPARATION: {
    code: 'EXPEDITION_EN_PREPARATION',
    label: '7. Expédition en préparation',
    stepNumber: 7,
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-300',
    category: 'CHINE',
    description: 'Intégré au lot d’expédition conteneur/vol.',
  },
  EXPEDIE: {
    code: 'EXPEDIE',
    label: '8. Expédié',
    stepNumber: 8,
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-400 font-semibold',
    category: 'TRANSIT',
    description: 'Le conteneur maritime ou vol cargo a quitté la Chine.',
  },
  EN_TRANSIT: {
    code: 'EN_TRANSIT',
    label: '9. En transit',
    stepNumber: 9,
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-400 font-semibold',
    category: 'TRANSIT',
    description: 'Marchandises en cours de traversée maritime ou aérienne.',
  },
  ARRIVE_DESTINATION: {
    code: 'ARRIVE_DESTINATION',
    label: '10. Arrivé à destination',
    stepNumber: 10,
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-400 font-semibold',
    category: 'DESTINATION',
    description: 'Arrivé au port ou aéroport de Kinshasa / Luanda.',
  },
  DEDOUANEMENT_TRAITEMENT: {
    code: 'DEDOUANEMENT_TRAITEMENT',
    label: '11. Dédouanement / Traitement',
    stepNumber: 11,
    badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-400',
    category: 'DESTINATION',
    description: 'Opérations douanières et dépotage en entrepôt local.',
  },
  DISPONIBLE_AGENCE: {
    code: 'DISPONIBLE_AGENCE',
    label: '12. Disponible à l’agence',
    stepNumber: 12,
    badgeClass: 'bg-green-100 text-green-900 border-green-400 font-bold',
    category: 'DESTINATION',
    description: 'Disponible pour retrait au guichet ou livraison programmée.',
  },
  PREPARATION_LIVRAISON: {
    code: 'PREPARATION_LIVRAISON',
    label: '13. Préparation de livraison',
    stepNumber: 13,
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-400',
    category: 'DESTINATION',
    description: 'Conditionnement final pour la tournée du livreur.',
  },
  EN_COURS_LIVRAISON: {
    code: 'EN_COURS_LIVRAISON',
    label: '14. En cours de livraison',
    stepNumber: 14,
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-500 font-bold animate-pulse',
    category: 'DESTINATION',
    description: 'Le livreur est en route vers l’adresse du client.',
  },
  LIVRE: {
    code: 'LIVRE',
    label: '15. Livré',
    stepNumber: 15,
    badgeClass: 'bg-emerald-600 text-white border-emerald-700 font-bold',
    category: 'CLOTURE',
    description: 'Colis remis en main propre au destinataire.',
  },
  RETIRE_CLIENT: {
    code: 'RETIRE_CLIENT',
    label: '16. Retiré par le client',
    stepNumber: 16,
    badgeClass: 'bg-emerald-700 text-white border-emerald-800 font-bold',
    category: 'CLOTURE',
    description: 'Colis retiré en agence avec décharge signée.',
  },
  ANOMALIE: {
    code: 'ANOMALIE',
    label: '17. Problème / Anomalie',
    stepNumber: 17,
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-400 font-bold',
    category: 'PROBLEME',
    description: 'Incident signalé : retard, casse constatée ou litige.',
  },
};

export interface StatusHistoryItem {
  id: string;
  status: ParcelStatus;
  date: string;
  time: string;
  user: string;
  agency?: string;
  comment?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  agencyId: string;
  agencyName: string;
  status: 'active' | 'inactive';
  createdAt: string;
  avatar?: string;
  clientId?: string; // Fiche client liée (rôle client uniquement)
}

export interface Agency {
  id: string;
  code: string;
  name: string;
  country: 'Chine' | 'RDC' | 'Angola';
  city: string;
  address: string;
  phone: string;
  email: string;
  type: 'origin' | 'destination' | 'hub';
  managerName?: string;
}

export interface Client {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  country: string;
  totalParcels: number;
  totalAmountUSD: number;
  totalPaidUSD: number;
  remainingBalanceUSD: number;
  createdAt: string;
  notes?: string;
  hasAccount?: boolean; // Le client a créé son compte en ligne
}

export interface Parcel {
  id: string;
  trackingNumber: string; // e.g. COL-2026-000001
  clientId: string;
  clientName: string;
  clientPhone: string;
  senderClientId?: string; // Expéditeur, s'il est aussi un client enregistré
  senderClientName?: string;
  description: string;
  quantity: number;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  volumeCbm: number; // Volume en m3
  photos: string[];
  supplier: string;
  purchaseInfo?: string;
  chinaReceptionAddress: string;
  chinaReceptionDate?: string;
  chinaAgencyId: string;
  chinaAgencyName: string;
  shipmentId?: string;
  shipmentNumber?: string;
  transportMode: TransportMode;
  origin: string;
  destination: string; // Kinshasa | Angola
  destinationAgencyId?: string;
  destinationAgencyName?: string;
  status: ParcelStatus;
  statusHistory: StatusHistoryItem[];
  pricingCurrency: Currency;
  pricingUnit?: 'KG' | 'CBM'; // Base de calcul figée : KG (aérien) ou CBM (maritime)
  pricePerKg?: number; // Tarif/kg figé à l'enregistrement, en pricingCurrency
  pricePerCbm?: number; // Tarif/CBM figé à l'enregistrement, en pricingCurrency
  pricingExchangeRate?: number; // Unités de pricingCurrency pour 1 USD à l'enregistrement
  freightAmount?: number; // Poids × tarif, en pricingCurrency
  totalAmount?: number; // Fret + frais annexes, en pricingCurrency
  transportCostUSD: number;
  extraFeesUSD: number;
  totalCostUSD: number;
  amountPaidUSD: number;
  remainingAmountUSD: number;
  warehouseLocation?: string; // Emplacement de stockage Kinshasa/Angola
  deliveryDriverName?: string;
  deliveryDriverPhone?: string;
  deliveryRecipient?: string;
  deliveryDate?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string; // e.g. EXP-2026-00012
  departureAgencyId: string;
  departureAgencyName: string;
  destination: string; // Kinshasa | Angola
  destinationAgencyId?: string;
  destinationAgencyName?: string;
  transportMode: TransportMode;
  carrierName: string; // e.g. Maersk / Ethiopian Cargo / Cosco
  containerOrFlightNumber: string;
  departureDate?: string;
  estimatedArrivalDate?: string;
  actualArrivalDate?: string;
  parcelCount: number;
  totalWeightKg: number;
  totalVolumeCbm: number;
  totalCostUSD: number;
  status: 'EN_PREPARATION' | 'EXPEDIE' | 'EN_TRANSIT' | 'ARRIVE' | 'TRAITE';
  parcelIds: string[];
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentType =
  | 'AVANCE'
  | 'SOLDE'
  | 'FRAIS_TRANSPORT'
  | 'FRAIS_SUPPLEMENTAIRES'
  | 'AUTRE_RECETTE';

export interface Payment {
  id: string;
  receiptNumber: string; // REC-2026-0001
  parcelId?: string;
  parcelTrackingNumber?: string;
  clientId: string;
  clientName: string;
  type: PaymentType;
  originalAmount: number;
  currency: Currency;
  exchangeRate: number; // Taux vers USD (ex: 1 USD = 2850 CDF)
  amountUSD: number;
  paymentMethod: 'ESPECES' | 'MOBILE_MONEY' | 'VIREMENT' | 'WECHAT_ALIPAY' | 'CARTE';
  reference?: string;
  date: string;
  time: string;
  agencyId: string;
  agencyName: string;
  cashierId: string;
  cashierName: string;
  notes?: string;
  receiptUrl?: string;
}

export type ExpenseCategory =
  | 'transport'
  | 'carburant'
  | 'manutention'
  | 'stockage'
  | 'douane'
  | 'achat'
  | 'salaire'
  | 'loyer'
  | 'communication'
  | 'materiel'
  | 'livraison'
  | 'frais_chine'
  | 'frais_kinshasa'
  | 'frais_angola'
  | 'autres';

export interface Expense {
  id: string;
  voucherNumber: string; // DEP-2026-0001
  category: ExpenseCategory;
  categoryLabel: string;
  originalAmount: number;
  currency: Currency;
  exchangeRate: number;
  amountUSD: number;
  agencyId: string;
  agencyName: string;
  country: 'Chine' | 'RDC' | 'Angola';
  beneficiary: string;
  date: string;
  time: string;
  recordedBy: string;
  description: string;
  attachmentName?: string;
  attachmentUrl?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  phone: string;
  jobTitle: string;
  agencyId: string;
  agencyName: string;
  country: 'Chine' | 'RDC' | 'Angola';
  baseSalaryUSD: number;
  preferredCurrency: Currency;
  status: 'actif' | 'inactif';
  hireDate: string;
}

export interface SalaryPayment {
  id: string;
  slipNumber: string; // PAY-2026-10-001
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  agencyName: string;
  country: 'Chine' | 'RDC' | 'Angola';
  periodMonth: string; // e.g. "2026-10"
  baseSalaryUSD: number;
  primesUSD: number;
  avancesUSD: number;
  retenuesUSD: number;
  overtimeUSD: number;
  netSalaryUSD: number;
  paidAmountOriginal: number;
  currency: Currency;
  exchangeRate: number;
  paymentDate: string;
  status: 'PAYE' | 'EN_ATTENTE';
  paymentMethod: string;
  notes?: string;
}

// Freight tariff fields are optional: older API responses may not include them.
export interface ExchangeRates extends Partial<FreightRates> {
  USD: number;
  CNY: number; // ex: 7.25
  CDF: number; // ex: 2850
  AOA: number; // ex: 920
  lastUpdated: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  agencyName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'PAYMENT' | 'EXPENSE' | 'PERMISSION_CHANGE' | 'LOGIN';
  entityType: 'PARCEL' | 'SHIPMENT' | 'PAYMENT' | 'EXPENSE' | 'CLIENT' | 'EMPLOYEE' | 'USER' | 'SETTINGS';
  entityId: string;
  details: string;
  // JSON : texte (ex. statut) ou objet complet (paramètres, données supprimées)
  oldValue?: unknown;
  newValue?: unknown;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  type: 'PARCEL_CREATED' | 'PARCEL_RECEIVED' | 'SHIPMENT_DEPARTED' | 'SHIPMENT_ARRIVED' | 'PARCEL_READY' | 'PARCEL_DELIVERED' | 'PAYMENT_RECEIVED' | 'ANOMALY';
  title: string;
  message: string;
  targetRole?: UserRole | 'ALL';
  parcelTracking?: string;
  isRead: boolean;
}

export interface DashboardStats {
  parcels: {
    total: number;
    inChina: number;
    inTransit: number;
    arrived: number;
    availableAtAgency: number;
    delivered: number;
    anomalies: number;
  };
  shipments: {
    total: number;
    maritime: number;
    aerien: number;
    inProgress: number;
    arrived: number;
  };
  finances: {
    totalRevenueUSD: number;
    totalExpensesUSD: number;
    netBalanceUSD: number;
    clientTotalPaidUSD: number;
    clientTotalRemainingUSD: number;
    totalSalariesPaidUSD: number;
    chinaExpensesUSD: number;
    kinshasaExpensesUSD: number;
    angolaExpensesUSD: number;
    balancesByCurrency: {
      USD: number;
      CNY: number;
      CDF: number;
      AOA: number;
    };
  };
  clients: {
    total: number;
    active: number;
    withPendingBalance: number;
  };
}
