import { redirect } from "next/navigation";

/** A entrada é única: os links antigos de cadastro levam para ela, mantendo o perfil escolhido. */
export default async function Cadastro({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const { perfil } = await searchParams;
  redirect(perfil === "motorista" || perfil === "passageiro" ? `/entrar?perfil=${perfil}` : "/entrar");
}
