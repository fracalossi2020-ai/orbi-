/**
 * Redes sociais e contato da Orbi, mostrados no fim da home e no rodapé.
 * Preencha com o endereço completo (ex.: "https://instagram.com/orbi"). Vazio = não aparece no site.
 * O WhatsApp do atendimento não fica aqui: é configurado no painel (/admin/configuracoes).
 */
export const SOCIAL: { id: string; label: string; icon: string; href: string }[] = [
  { id: "instagram", label: "Instagram", icon: "instagram", href: "" },
  { id: "tiktok", label: "TikTok", icon: "tiktok", href: "" },
  { id: "facebook", label: "Facebook", icon: "facebook", href: "" },
  { id: "email", label: "E-mail", icon: "mail", href: "" },
];

export const socialLinks = () => SOCIAL.filter((s) => s.href);
