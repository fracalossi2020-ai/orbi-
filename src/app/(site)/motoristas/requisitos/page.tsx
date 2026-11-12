import Link from "next/link";
import { getDb } from "@/db";
import { getSetting } from "@/db/seed";
import { Icon } from "@/components/Icon";
import { Body, PageHead } from "@/components/site/Page";
import { Reveal } from "@/components/site/Fx";
import { withDefaultRules, DEFAULT_DRIVER_RULES, DOC_INFO, type DriverRules } from "@/domain/driver-rules";

export const metadata = { title: "Requisitos para dirigir", description: "O que você precisa para ser motorista parceiro da Orbi no Vale do Aço: CNH com EAR, documentos, carro e regularização." };

async function rules() {
  try { return await getSetting<Partial<DriverRules>>(await getDb(), "driverRules", DEFAULT_DRIVER_RULES).then(withDefaultRules); } catch { return DEFAULT_DRIVER_RULES; }
}

export default async function Requisitos() {
  const r = await rules();
  const oldest = new Date().getFullYear() - r.maxVehicleAge;
  const groups: { icon: string; title: string; items: string[] }[] = [
    { icon: "user", title: "Você", items: [
      `Ter ${r.minAge} anos ou mais.`,
      "Ter CPF e um celular com internet e GPS (iPhone ou Android).",
      "Morar ou rodar em Ipatinga, Coronel Fabriciano ou Timóteo.",
    ] },
    { icon: "steering", title: "Sua CNH", items: [
      "CNH definitiva, categoria B ou superior, dentro da validade. Permissão Para Dirigir (provisória) não é aceita.",
      "Com a observação \"Exerce Atividade Remunerada\" (EAR), exigida por lei. Sem ela, peça a inclusão no Detran-MG.",
      ...(r.minLicenseYears ? [`Habilitação há pelo menos ${r.minLicenseYears} ${r.minLicenseYears === 1 ? "ano" : "anos"}.`] : []),
    ] },
    { icon: "car", title: "Seu carro", items: [
      `Ano ${oldest} ou mais novo.`,
      `Pelo menos ${r.minDoors} portas e ${r.minSeats} lugares${r.requireAirConditioning ? ", com ar-condicionado funcionando" : ""}.`,
      "CRLV (documento do carro) do ano em dia. Pode ser seu, financiado, de alguém da família ou alugado.",
      "Sem placa vermelha e sem adesivos comerciais.",
    ] },
    { icon: "doc", title: "Documentos para enviar", items: r.requiredDocs.map((k) => `${DOC_INFO[k].label}: ${DOC_INFO[k].hint}`) },
    { icon: "shield", title: "Regularização", items: [
      "Inscrição no INSS como contribuinte individual. O MEI de motorista de aplicativo é aberto de graça no portal gov.br e já cumpre essa exigência.",
      "Certidão negativa de antecedentes criminais (Polícia Federal ou Polícia Civil de MG).",
      "Aceite do Termo de adesão do motorista parceiro.",
      "Exigências do município, quando houver (como cadastro municipal e seguro APP). A equipe avisa se a sua cidade pedir.",
    ] },
  ];
  return (
    <>
      <PageHead eyebrow="Seja motorista parceiro" title="O que você precisa para dirigir." lead="A lista completa, antes de começar. A base é a lei federal do transporte por aplicativo (Lei 13.640/2018); idade do carro e alguns documentos seguem a regra de cada cidade.">
        <Link href="/entrar?perfil=motorista" className="btn btn-lg btn-on-deep">Começar meu cadastro <Icon name="arrow" size={18} /></Link>
        <Link href="/termos-motorista" className="btn btn-lg btn-line-deep">Ler o termo de adesão</Link>
      </PageHead>
      <Body>
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g, i) => (
            <Reveal key={g.title} delay={i * .05} className="card p-6">
              <h2 className="display flex items-center gap-3 text-2xl"><span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-brand"><Icon name={g.icon} size={22} weight="duotone" /></span>{g.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {g.items.map((it) => <li key={it} className="flex gap-2.5 text-sm"><span className="mt-0.5 text-brand"><Icon name="check" size={18} /></span><span>{it}</span></li>)}
              </ul>
            </Reveal>
          ))}
          <Reveal delay={.25} className="card p-6">
            <h2 className="display text-2xl">Como é o cadastro</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {["Crie a conta como motorista e preencha seus dados, a CNH e o endereço.", "Envie os documentos pelo celular, em foto ou PDF.", "Cadastre o carro.", "A equipe confere tudo e aprova. Você recebe o aviso no aplicativo.", "Fique online quando quiser. Você vê o ganho antes de aceitar cada corrida."].map((s, i) => (
                <li key={s} className="flex gap-3"><span className="num grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">{i + 1}</span><span>{s}</span></li>
              ))}
            </ol>
            <Link href="/entrar?perfil=motorista" className="btn btn-primary mt-6 w-full">Começar meu cadastro</Link>
          </Reveal>
        </div>
      </Body>
    </>
  );
}
