/**
 * Portal strings. English is the source; French must have the same keys (the
 * type enforces it and a test double-checks). `{name}` placeholders are
 * filled by `format`.
 */
export const en = {
  common: {
    appName: 'Shop portal',
    signOut: 'Sign out',
    language: 'Français',
    notConfigured:
      'The portal is not connected to Supabase yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  },
  signIn: {
    title: 'Staff sign-in',
    intro: 'We will email you a six-digit code. Only staff added to a shop can sign in.',
    email: 'Work email',
    sendCode: 'Email me a code',
    sending: 'Sending…',
    codeSent: 'We sent a code to {email}. It expires in a few minutes.',
    code: 'Six-digit code',
    verify: 'Sign in',
    verifying: 'Signing in…',
    useOtherEmail: 'Use a different email',
    sendFailed: 'We could not send a code. Check the address, or ask us to add you as staff.',
    verifyFailed: 'That code did not work. Check it, or ask for a new one.',
  },
  tenants: {
    title: 'Choose a shop',
    intro: 'You are staff at more than one shop.',
    none: 'Your account is not staff at any shop yet. Ask us to add you.',
    owner: 'Owner',
    staff: 'Staff',
  },
  brand: {
    title: 'Brand',
    intro: 'Your shop name, colour and contact details as customers see them in your app.',
    switchShop: 'Switch shop',
    logo: 'Logo',
    logoHelp: 'PNG, JPEG or WebP, up to 1 MB. A square image works best.',
    logoUpload: 'Upload logo',
    logoUploading: 'Uploading…',
    logoRemove: 'Remove logo',
    logoNone: 'No logo yet.',
    logoTooBig: 'That file is over 1 MB.',
    logoWrongType: 'Use a PNG, JPEG or WebP image.',
    logoFailed: 'The upload failed. Try again.',
    accent: 'Accent colour',
    accentHelp: 'Used for buttons and highlights in your app.',
    accentHex: 'Hex code',
    contrast: 'Button text contrast: {ratio}:1',
    contrastPass: 'Readable (needs 4.5:1).',
    contrastFail: 'Too low: no text colour reaches 4.5:1 on this accent. Pick a darker or lighter colour.',
    details: 'Shop details',
    name: 'Shop name',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    bookingUrl: 'Booking link',
    websiteUrl: 'Website',
    urlHelp: 'Full address starting with https://',
    hours: 'Opening hours',
    hoursHelp: 'Tick the days you are open.',
    open: 'Open',
    opens: 'Opens',
    closes: 'Closes',
    preview: 'Preview',
    previewHelp: 'How your accent looks on a button in light and dark mode.',
    previewLight: 'Light',
    previewDark: 'Dark',
    previewButton: 'Book a service',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Saved. Your app picks up the changes the next time it goes online.',
    saveFailed: 'We could not save your changes. Try again.',
    fixErrors: 'Fix the highlighted fields and save again.',
    notFound: 'This shop was not found, or you are not staff there.',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    errors: {
      nameRequired: 'Enter the shop name.',
      accentInvalid: 'Use a colour like #1A73E8.',
      accentNoContrast: 'No text colour is readable on this accent. Pick a darker or lighter colour.',
      logoInvalid: 'Upload the logo again.',
      emailInvalid: 'Enter an email like service@shop.ca.',
      urlInvalid: 'Enter a full link starting with https://',
      hoursInvalid: 'Each open day needs an opening time before its closing time.',
    },
  },
};

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends string[] ? string[] : Shape<T[K]> };

export type Messages = Shape<typeof en>;

export const fr: Messages = {
  common: {
    appName: 'Portail de l’atelier',
    signOut: 'Se déconnecter',
    language: 'English',
    notConfigured:
      'Le portail n’est pas encore relié à Supabase. Définissez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  },
  signIn: {
    title: 'Connexion du personnel',
    intro: 'Nous vous enverrons un code à six chiffres par courriel. Seul le personnel ajouté à un atelier peut se connecter.',
    email: 'Courriel professionnel',
    sendCode: 'M’envoyer un code',
    sending: 'Envoi…',
    codeSent: 'Nous avons envoyé un code à {email}. Il expire dans quelques minutes.',
    code: 'Code à six chiffres',
    verify: 'Se connecter',
    verifying: 'Connexion…',
    useOtherEmail: 'Utiliser un autre courriel',
    sendFailed: 'Impossible d’envoyer un code. Vérifiez l’adresse ou demandez-nous de vous ajouter au personnel.',
    verifyFailed: 'Ce code n’a pas fonctionné. Vérifiez-le ou demandez-en un nouveau.',
  },
  tenants: {
    title: 'Choisir un atelier',
    intro: 'Vous faites partie du personnel de plus d’un atelier.',
    none: 'Votre compte ne fait partie du personnel d’aucun atelier pour l’instant. Demandez-nous de vous ajouter.',
    owner: 'Propriétaire',
    staff: 'Personnel',
  },
  brand: {
    title: 'Image de marque',
    intro: 'Le nom, la couleur et les coordonnées de votre atelier, tels que vos clients les voient dans votre appli.',
    switchShop: 'Changer d’atelier',
    logo: 'Logo',
    logoHelp: 'PNG, JPEG ou WebP, 1 Mo au maximum. Une image carrée convient le mieux.',
    logoUpload: 'Téléverser un logo',
    logoUploading: 'Téléversement…',
    logoRemove: 'Retirer le logo',
    logoNone: 'Aucun logo pour l’instant.',
    logoTooBig: 'Ce fichier dépasse 1 Mo.',
    logoWrongType: 'Utilisez une image PNG, JPEG ou WebP.',
    logoFailed: 'Le téléversement a échoué. Réessayez.',
    accent: 'Couleur d’accent',
    accentHelp: 'Utilisée pour les boutons et les éléments mis en valeur dans votre appli.',
    accentHex: 'Code hexadécimal',
    contrast: 'Contraste du texte des boutons : {ratio}:1',
    contrastPass: 'Lisible (4,5:1 requis).',
    contrastFail:
      'Trop faible : aucune couleur de texte n’atteint 4,5:1 sur cet accent. Choisissez une couleur plus foncée ou plus claire.',
    details: 'Coordonnées de l’atelier',
    name: 'Nom de l’atelier',
    phone: 'Téléphone',
    email: 'Courriel',
    address: 'Adresse',
    bookingUrl: 'Lien de réservation',
    websiteUrl: 'Site Web',
    urlHelp: 'Adresse complète commençant par https://',
    hours: 'Heures d’ouverture',
    hoursHelp: 'Cochez les jours d’ouverture.',
    open: 'Ouvert',
    opens: 'Ouverture',
    closes: 'Fermeture',
    preview: 'Aperçu',
    previewHelp: 'L’allure de votre accent sur un bouton en mode clair et en mode sombre.',
    previewLight: 'Clair',
    previewDark: 'Sombre',
    previewButton: 'Prendre rendez-vous',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: 'Enregistré. Votre appli recevra les changements à sa prochaine connexion.',
    saveFailed: 'Impossible d’enregistrer vos changements. Réessayez.',
    fixErrors: 'Corrigez les champs signalés, puis enregistrez de nouveau.',
    notFound: 'Cet atelier est introuvable, ou vous ne faites pas partie de son personnel.',
    days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    errors: {
      nameRequired: 'Entrez le nom de l’atelier.',
      accentInvalid: 'Utilisez une couleur comme #1A73E8.',
      accentNoContrast:
        'Aucune couleur de texte n’est lisible sur cet accent. Choisissez une couleur plus foncée ou plus claire.',
      logoInvalid: 'Téléversez le logo de nouveau.',
      emailInvalid: 'Entrez un courriel comme service@atelier.ca.',
      urlInvalid: 'Entrez un lien complet commençant par https://',
      hoursInvalid: 'Chaque jour d’ouverture doit avoir une heure d’ouverture avant l’heure de fermeture.',
    },
  },
};

export type Locale = 'en' | 'fr';

export const messages: Record<Locale, Messages> = { en, fr };

/** Fills `{key}` placeholders. Unknown keys are left as written. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** `fr` when the cookie says so or the browser prefers French, else `en`. */
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (cookie === 'en' || cookie === 'fr') return cookie;
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('fr') ? 'fr' : 'en';
}

/** BCP 47 tag for formatting, Canadian by default. */
export function localeTag(locale: Locale): string {
  return locale === 'fr' ? 'fr-CA' : 'en-CA';
}
