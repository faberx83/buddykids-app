import { redirect } from "next/navigation";

// SPRINT 7 (feedback Fabrizio: "Logistica e Famiglia non devono diventare
// una sezione ad hoc?") — l'hub "Logistica & Famiglia" e' stato eliminato:
// Indirizzi/Famiglia/Condivisione piano sono ora vere sezioni dentro Profilo
// (vedi app/nextgen/profile/ProfileNextgenClient.tsx), non piu' un link
// separato dal Planner. Questa rotta resta come semplice redirect (non un
// 404 secco) per non rompere eventuali link salvati/bookmark verso il
// vecchio hub.
// SPRINT 4 correttivo (audit link) — il target era rimasto "/nextgen/profile"
// da quando la sezione Famiglia viveva in prima pagina; dopo la successiva
// consolidazione (task #236, "Famiglia e logistica" nascosta dietro un hub
// card) chi arrivava da un vecchio bookmark si fermava un click prima della
// destinazione reale. Aggiornato per puntare direttamente all'hub attuale.
export default function LogisticaPage() {
  redirect("/nextgen/profile/famiglia");
}
