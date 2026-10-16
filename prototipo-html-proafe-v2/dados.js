/*
 * Dados de exemplo do protótipo HTML do PROAFE — os mesmos do Figma
 * (EMEI JP Cirandinha, exercícios 2025 e 2026).
 *
 * Valores em centavos (inteiros), para a conta não ter erro de arredondamento.
 * EFS: docs/gerenciamento-de-escolas/cadastro-de-financeiro-proafe.md
 */

const ANO_CORRENTE = 2026;

const TIPOS = {
  emenda: "Emenda parlamentar",
  op: "Orçamento participativo",
  programa: "Programa",
  recurso: "Recurso extraordinário",
};

/* Listas globais (Tabelas do Financeiro). Programa: só os Vigentes são
   oferecidos no cadastro (RN011); Escola Aberta está Extinto. */
const PROGRAMAS = [
  {
    nome: "Adote um escritor",
    situacao: "Vigente",
    sei: "26.0.000110233-4",
    unidade: "DP — Diretoria Pedagógica",
    objeto:
      "Contratação de autores(as) e ilustradores(as) para visitas às escolas. Aquisição de livros de autores(as) adotados pelas escolas e atualização de acervos bibliográficos.",
  },
  {
    nome: "Escola Aberta",
    situacao: "Extinto",
    sei: "21.0.000034567-1",
    unidade: "DP — Diretoria Pedagógica",
    objeto:
      "Oficinas de esporte, cultura e lazer nos fins de semana, com a escola aberta à comunidade.",
  },
  {
    nome: "SECON",
    situacao: "Vigente",
    sei: "25.0.000098712-3",
    unidade: "DP — Diretoria Pedagógica",
    objeto: "Atividades de educação ambiental e sustentabilidade na escola.",
  },
  {
    nome: "Transporte JESPOA",
    situacao: "Vigente",
    sei: "24.0.000076543-9",
    unidade: "DEF — Diretoria de Educação Física",
    objeto: "Transporte dos estudantes para os Jogos Escolares de Porto Alegre.",
  },
  {
    nome: "Transporte SIC",
    situacao: "Vigente",
    sei: "22.0.000054321-0",
    unidade: "DP — Diretoria Pedagógica",
    objeto: "Transporte dos estudantes para o Salão de Iniciação Científica.",
  },
];

const RECURSOS = [
  "Alimentação especial",
  "Curso brigadista",
  "Feira do livro - transporte",
  "Hidrojateamento/esgoto",
  "Incentivo cultural",
  "Manutenção",
  "Mobiliário",
  "Transporte",
];

/* Servidores — por ora, todos os servidores (RN027). Nomes e documentos fictícios. */
const SERVIDORES = [
  { nome: "Ana Paula Ribeiro", cpf: "111.222.333-44", matricula: "104521-3" },
  { nome: "Carlos Henrique Souza", cpf: "222.333.444-55", matricula: "098734-1" },
  { nome: "Juliana Martins", cpf: "333.444.555-66", matricula: "112908-7" },
  { nome: "Marcos Vinícius Lima", cpf: "444.555.666-77", matricula: "087615-2" },
  { nome: "Patrícia Gomes", cpf: "555.666.777-88", matricula: "120044-9" },
];

const CONTA_ATIVA = {
  banco: "001 - Banco do Brasil",
  agencia: "0200",
  conta: "45678-9",
  situacao: "Ativa",
};

function c(reais) {
  return Math.round(reais * 100);
}

/* Repasse ordinário por exercício. saldoAnt só existe no primeiro exercício;
   nos demais, é o saldo total do anterior (RN030). */
function ordinarioExemplo() {
  return {
    2025: {
      previsao: c(200000),
      saldoAnt: { c: c(8000), k: c(4000) },
      despesas: { c: c(153000), k: c(25500) },
      atualizacao: "30/12/2025 às 16:05, por ana.ribeiro",
      origemPrevisao: "31/03/2025 às 10:02, por ana.ribeiro",
    },
    2026: {
      previsao: c(230000),
      despesas: { c: c(26500), k: c(20100) },
      atualizacao: "30/09/2026 às 16:05, por ana.ribeiro",
      origemPrevisao: "19/01/2026 às 14:30, por ana.ribeiro",
    },
  };
}

/* Repasses complementares. valores[ano]: previsão e despesas do ano; saldoAnt
   só quando o repasse não veio copiado do ano anterior. copiado[ano] = true
   liga o saldo anterior do ano ao saldo total do anterior (RN018, RN030). */
function complementaresExemplo() {
  return [
    {
      id: "e1", tipo: "emenda", numero: "00010001/2025", sei: "25.0.000210001-1",
      categoria: "custeio", origem: 2025,
      objeto:
        "Aquisição de materiais pedagógicos e de consumo para as turmas de educação infantil — jogos educativos, livros de literatura infantil e materiais de artes.",
      valores: { 2025: { saldoAnt: 0, previsao: c(12000), despesas: c(11500) }, 2026: { previsao: c(12000), despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "o1", tipo: "op", numero: "00010002/2025", sei: "25.0.000210002-0",
      categoria: "capital", origem: 2025,
      objeto: "Compra de equipamentos para a sala de informática, aprovada no Orçamento Participativo da região.",
      valores: { 2025: { saldoAnt: 0, previsao: c(12000), despesas: c(11500) }, 2026: { previsao: c(12000), despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "p1", tipo: "programa", item: "Adote um escritor", categoria: "custeio", origem: 2023,
      assessor: SERVIDORES[0],
      valores: { 2025: { saldoAnt: c(3000), previsao: c(10000), despesas: c(11749.6) }, 2026: { previsao: c(11200), despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "p2", tipo: "programa", item: "Adote um escritor", categoria: "capital", origem: 2023,
      assessor: SERVIDORES[0],
      valores: { 2025: { saldoAnt: c(1000), previsao: c(3000), despesas: c(1650) }, 2026: { previsao: null, despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "p3", tipo: "programa", item: "Transporte JESPOA", categoria: "custeio", origem: 2024,
      assessor: SERVIDORES[2],
      valores: { 2025: { saldoAnt: c(2000), previsao: 0, despesas: c(2000) } },
      copiado: {},
    },
    {
      id: "p4", tipo: "programa", item: "Transporte SIC", categoria: "custeio", origem: 2022,
      assessor: SERVIDORES[2],
      valores: { 2025: { saldoAnt: c(3200), previsao: 0, despesas: 0 }, 2026: { previsao: 0, despesas: c(3200) } },
      copiado: { 2026: true },
    },
    {
      id: "p5", tipo: "programa", item: "Escola Aberta", categoria: "custeio", origem: 2021,
      assessor: SERVIDORES[1],
      orientacao:
        "Utilizar o saldo em material de consumo pedagógico até 31/12/2027, conforme combinado com a unidade de referência.",
      valores: { 2025: { saldoAnt: c(900), previsao: 0, despesas: c(420) }, 2026: { previsao: 0, despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "r1", tipo: "recurso", item: "Alimentação especial", sei: "24.0.000300101-5", categoria: "custeio", origem: 2024,
      assessor: SERVIDORES[3], objeto: "Alimentação para estudantes com restrição alimentar.",
      valores: { 2025: { saldoAnt: c(500), previsao: 0, despesas: 0 }, 2026: { previsao: c(9500), despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "r2", tipo: "recurso", item: "Curso brigadista", sei: "25.0.000300202-4", categoria: "custeio", origem: 2025,
      assessor: SERVIDORES[3], objeto: "Formação de brigada de incêndio para a equipe da escola.",
      valores: { 2025: { saldoAnt: 0, previsao: c(2000), despesas: 0 }, 2026: { previsao: c(3000), despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "r3", tipo: "recurso", item: "Feira do livro - transporte", sei: "24.0.000300303-3", categoria: "custeio", origem: 2024,
      assessor: SERVIDORES[4], objeto: "Transporte das turmas para a Feira do Livro de Porto Alegre.",
      valores: { 2025: { saldoAnt: c(750), previsao: 0, despesas: 0 }, 2026: { previsao: c(4250), despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "r4", tipo: "recurso", item: "Feira do livro - transporte", sei: "23.0.000300404-2", categoria: "custeio", origem: 2023,
      assessor: SERVIDORES[4], objeto: "Transporte das turmas para a Feira do Livro de 2023.",
      valores: { 2025: { saldoAnt: c(300), previsao: 0, despesas: c(300) } },
      copiado: {},
    },
    {
      id: "r5", tipo: "recurso", item: "Incentivo cultural", sei: "25.0.000300505-1", categoria: "capital", origem: 2025,
      assessor: null, objeto: "Instrumentos musicais para a oficina de música.",
      valores: { 2025: { saldoAnt: 0, previsao: c(1800), despesas: 0 }, 2026: { previsao: c(3200), despesas: null } },
      copiado: { 2026: true },
    },
    {
      id: "r6", tipo: "recurso", item: "Manutenção", sei: "26.0.000300606-0", categoria: "custeio", origem: 2026,
      assessor: SERVIDORES[1], objeto: "Reparo do telhado do bloco B.",
      valores: { 2026: { saldoAnt: 0, previsao: c(12500), despesas: null } },
      copiado: {},
    },
  ];
}

function historicoExemplo() {
  return [
    { data: "30/09/2026 16:05", usuario: "ana.ribeiro", acao: "Alteração", detalhe: "Repasse ordinário de 2026 — Despesas de custeio: 20.000,00 → 26.500,00" },
    { data: "19/01/2026 14:30", usuario: "ana.ribeiro", acao: "Importação da planilha de valores", detalhe: "Previsão do repasse anual de 2026: 230.000,00" },
    { data: "15/01/2026 09:12", usuario: "ana.ribeiro", acao: "Abertura de exercício", detalhe: "Exercício 2026 aberto para a rede (portaria 00000001/2026), com 10 repasses complementares levados de 2025" },
    { data: "02/03/2025 10:40", usuario: "carlos.souza", acao: "Inclusão", detalhe: "Conta bancária 001 - Banco do Brasil · 0200 · 45678-9" },
  ];
}

/* ─── Exercício geral (proposta) ──────────────────────────────────────────────
   O exercício é aberto UMA VEZ para a rede, com o Nº da portaria; a previsão de
   cada escola entra pela importação do Anexo I da portaria. A escola detalhada
   deste protótipo é a EMEI JP Cirandinha; as outras escolas da rede aparecem só
   no resumo da tela Financeiro › Exercícios. Nomes e valores fictícios. */

const ESCOLA = { id: "cirandinha", nome: "EMEI JP Cirandinha" };

function exerciciosExemplo() {
  return {
    2025: { portaria: "32968530/2025", periodo: { ini: 4, fim: 12, prazo: "" }, abertoEm: "31/03/2025 às 09:10", por: "ana.ribeiro", anexo: { data: "31/03/2025 às 10:02", por: "ana.ribeiro", qtd: 101, fora: [], arquivo: "Anexo_I_Portaria_PROAFE_2025.xls" } },
    2026: { portaria: "00000001/2026", periodo: { ini: 1, fim: 12, prazo: "" }, abertoEm: "15/01/2026 às 09:12", por: "ana.ribeiro", anexo: { data: "19/01/2026 às 14:30", por: "ana.ribeiro", qtd: 101, fora: [], arquivo: "(PROAFE MENSAL)Anexo_I___Portaria_PROAFE_2026.xls" } },
  };
}

/* Anexo I da portaria do PROAFE — dados da planilha real usada pela SMED
   ("(PROAFE MENSAL)Anexo_I___Portaria_PROAFE_2026.xls", aba "Anexo I"):
   Nº, ESCOLA e VALOR MENSAL FINAL (em centavos). A planilha identifica a
   escola só pelo nome e repete o cabeçalho em 5 linhas (quebras de página).
   É usada como "planilha de exemplo" na importação e como cadastro das outras
   escolas públicas da rede neste protótipo. A linha 101, da EMEI JP Cirandinha
   (escola fictícia, a única com tela própria), foi acrescentada para a
   importação seguir o caminho feliz: todas as escolas do SIE na planilha. */
const ANEXO_I_EXEMPLO = {
  arquivo: "(PROAFE MENSAL)Anexo_I___Portaria_PROAFE_2026.xls",
  aba: "Anexo I",
  cabecalhosRepetidos: 5,
  linhas: [
    [1, "CMET Paulo Freire", 1559832],
    [2, "EMEB Dr. Liberato Salzano Vieira da Cunha", 2974005],
    [3, "EMEB Leopolda Barnewitz", 1035271],
    [4, "EMEEF Prof. Elyseu Paglioli", 897015],
    [5, "EMEEF Prof. Luiz Francisco Lucena Borges", 983187],
    [6, "EMEEF Prof. Lygia Morrone Avertuck", 882484],
    [7, "EMEEF Tristão Sucupira Vianna", 914691],
    [8, "EMEF Afonso Guerreiro Lima", 2194705],
    [9, "EMEF América", 935786],
    [10, "EMEF Aramy Silva", 1778482],
    [11, "EMEF Campos do Cristal", 1877618],
    [12, "EMEF Chapéu do Sol", 2919789],
    [13, "EMEF Chico Mendes", 2304195],
    [14, "EMEF de Surdos Bilíngue Salomão Watnick", 621315],
    [15, "EMEF Décio Martins Costa", 2367975],
    [16, "EMEF Dep. Marcírio Goulart Loureiro", 1819358],
    [17, "EMEF Dep. Victor Issler", 2510151],
    [18, "EMEF Dolores Alcaraz Caldas", 2965647],
    [19, "EMEF Gabriel Obino", 2590346],
    [20, "EMEF Gov. Ildo Meneguetti", 2464689],
    [21, "EMEF Grande Oriente do Rio grande do Sul", 2804530],
    [22, "EMEF Heitor Villa Lobos", 2151991],
    [23, "EMEF Jean Piaget", 2657106],
    [24, "EMEF João Antônio Satte", 2122791],
    [25, "EMEF José Loureiro da Silva", 2306417],
    [26, "EMEF José Mariano Beck", 2127595],
    [27, "EMEF Lauro Rodrigues", 1799006],
    [28, "EMEF Leocádia Felizardo Prestes", 1434259],
    [29, "EMEF Lidovino Fanton", 2070213],
    [30, "EMEF Mario Quintana", 2164678],
    [31, "EMEF Migrantes", 627258],
    [32, "EMEF Moradas da Hipica", 2524093],
    [33, "EMEF Morro da Cruz", 2400473],
    [34, "EMEF Neusa Goulart Brizola", 1784205],
    [35, "EMEF Nossa Senhora de Fátima", 1842199],
    [36, "EMEF Nossa Senhora do Carmo", 2245639],
    [37, "EMEF Paixão Cortês", 884399],
    [38, "EMEF Pepita de Leão", 1009247],
    [39, "EMEF Porto Alegre", 723456],
    [40, "EMEF Porto Novo", 2005968],
    [41, "EMEF Pres. João Belchior Marques Goulart", 2464856],
    [42, "EMEF Presidente Vargas", 1285500],
    [43, "EMEF Prof. Ana Iris do Amaral", 1619096],
    [44, "EMEF Prof. Anisio Teixeira", 2091307],
    [45, "EMEF Prof. Gilberto Jorge Gonçalves da Silva", 1171058],
    [46, "EMEF Prof. Judith Macedo de Araujo", 1517892],
    [47, "EMEF Prof. Larry José Ribeiro Alves", 3475553],
    [48, "EMEF Rincão", 2104293],
    [49, "EMEF Sain't Hilaire", 1946907],
    [50, "EMEF São Pedro", 1967677],
    [51, "EMEF Sen. Alberto Pasqualini", 2565666],
    [52, "EMEF Timbaúva", 1605692],
    [53, "EMEF Ver. Antonio Giudice", 2306153],
    [54, "EMEF Ver. Carlos Pessoa de Brum", 2788336],
    [55, "EMEF Ver. Martim Aranha", 1839581],
    [56, "EMEF Vila Monte Cristo", 2446416],
    [57, "EMEF Wenceslau Fontoura", 2719578],
    [58, "EMEI Bairro Cavalhada", 745541],
    [59, "EMEI Dom Luiz de Nadal", 1141744],
    [60, "EMEI Doutor Walter Silber", 1055439],
    [61, "EMEI Érico Verissimo", 1634147],
    [62, "EMEI Florencia Vurlod Socias", 1271245],
    [63, "EMEI Humaitá", 751541],
    [64, "EMEI Ilha da Pintada", 1055439],
    [65, "EMEI Jardim Bento Gonçalves", 611909],
    [66, "EMEI Jardim Camaquã", 745541],
    [67, "EMEI Jardim de Praça Cantinho Amigo", 745541],
    [68, "EMEI Jardim de Praça Cirandinha", 395920],
    [69, "EMEI Jardim de Praça Girafinha", 611909],
    [70, "EMEI Jardim de Praça Meu Amiguinho", 611909],
    [71, "EMEI Jardim de Praça Passarinho Dourado", 395920],
    [72, "EMEI Jardim de Praça Patinho Feio", 611909],
    [73, "EMEI Jardim de Praça Pica-Pau Amarelo", 611909],
    [74, "EMEI Jardim Salomoni", 752453],
    [75, "EMEI Mamãe Coruja", 623909],
    [76, "EMEI Maria Marques Fernandes", 1061439],
    [77, "EMEI Max Geiss", 1067439],
    [78, "EMEI Miguel Granato Velasquez", 1400309],
    [79, "EMEI Municiparios Tio Barnabé", 1067439],
    [80, "EMEI Nova Gleba", 1061439],
    [81, "EMEI Osmar dos Santos Freitas", 1067439],
    [82, "EMEI Padre Angelo Costa", 1061439],
    [83, "EMEI Parque dos Maias II", 751541],
    [84, "EMEI Paulo Freire", 1061439],
    [85, "EMEI Ponta Grossa", 1435473],
    [86, "EMEI Prof. Maria Helena Cavalheiro Gusmão", 617909],
    [87, "EMEI Protásio Alves", 1061439],
    [88, "EMEI Santo Expedito", 1603004],
    [89, "EMEI Vale Verde", 751541],
    [90, "EMEI Vila da Pascoa", 611909],
    [91, "EMEI Vila Elizabeth", 751541],
    [92, "EMEI Vila Floresta", 751541],
    [93, "EMEI Vila Mapa II", 1067439],
    [94, "EMEI Vila Nova", 751541],
    [95, "EMEI Vila Nova Restinga", 1286419],
    [96, "EMEI Vila Nova São Carlos", 1061439],
    [97, "EMEI Vila Santa Rosa", 1061439],
    [98, "EMEI Vila Tronco", 1061439],
    [99, "EMEI Vila Valneri Antunes", 1451867],
    [100, "EMEM Emilio Meyer", 2063333],
    [101, "EMEI JP Cirandinha", 1916667]
  ],
};

/* Outras escolas públicas da rede (resumo): as 100 escolas do Anexo I. Em 2026
   a previsão anual é o valor mensal × 12 (exercício de janeiro a dezembro); em 2025 (portaria 32968530/2025, repasses de abril a dezembro), × 9 e um valor mensal um pouco menor. */
/* Exemplos de pendência na lista de escolas do exercício: duas escolas sem
   conta bancária ativa e uma escola que entrou no PROAFE em 2027 (sem saldo do
   exercício anterior para trazer). */
const ESCOLAS_SEM_CONTA = [37, 64];
const ESCOLA_NOVA_2027 = { n: 102, nome: "EMEI Nova Aurora", mensal: 1180000 };

function redeExemplo() {
  return ANEXO_I_EXEMPLO.linhas.filter(([, nome]) => nome !== ESCOLA.nome).map(([n, nome, mensal]) => ({
    id: "a" + n,
    nome,
    conta: !ESCOLAS_SEM_CONTA.includes(n),
    anos: { 2025: { previsao: Math.round(mensal * 9 * 0.95), saldoAnt: true }, 2026: { previsao: mensal * 12 } },
  }));
}

/* Cenários da barra do protótipo. */
function estadoInicial(cenario) {
  const base = {
    conta: { ...CONTA_ATIVA },
    contasAnteriores: [],
    conselho: true,
    ordinario: ordinarioExemplo(),
    complementares: complementaresExemplo(),
    historico: historicoExemplo(),
    exercicios: exerciciosExemplo(),
    rede: redeExemplo(),
  };
  if (cenario === "sem-conselho") base.conselho = false;
  if (cenario === "conta-inativa") base.conta.situacao = "Inativa";
  if (cenario === "sem-conta") base.conta = null;
  if (cenario === "saldos-zerados") {
    // Escola só com 2026, sem complementares, e as despesas iguais à previsão:
    // saldo zero no ordinário e nos complementares, então a conta pode ser inativada.
    base.ordinario = { 2026: { previsao: c(230000), saldoAnt: { c: 0, k: 0 }, despesas: { c: c(184000), k: c(46000) }, atualizacao: "30/09/2026 às 16:05, por ana.ribeiro", origemPrevisao: "19/01/2026 às 14:30, por ana.ribeiro" } };
    base.complementares = [];
  }
  if (cenario === "sem-exercicio") {
    base.ordinario = {};
    base.complementares = [];
    base.historico = [];
    base.exercicios = {};
    base.rede.forEach((e) => (e.anos = {}));
  }
  return base;
}

/* Lista de escolas (tela Escolas, Figma 46-3513). Só a EMEI JP Cirandinha abre;
   as outras estão aqui para a lista ficar como no protótipo. Dados fictícios. */
const MANTENEDORA = "Mantenedora: ASSOCIAÇÃO DOS MORADORES DO LOTEAMENTO…";
const ESCOLAS_LISTA = [
  { id: "cirandinha", nome: "EMEI JP Cirandinha", situacao: "Em atividade", cnpj: "19.720.399/0001-03", inep: "31167436", escola: "101", estab: "248", nivel: ["Ed. Infantil - Creche | Pré-escola"], dep: "Municipal", vinculo: "Pública", bairro: "Menino Deus", op: "Região 16 - CENTRO", ct: "Micro 10", cadastro: "12/04/2026", cme: "Vigente", doc: [["Regularizada"]] },
  { nome: "APAE João Alfredo", situacao: "Em atividade", cnpj: "19.720.399/0001-03", inep: "31167436", escola: "102", estab: "89", nivel: ["Ed. Infantil - Creche | Pré-escola"], dep: "Municipal", vinculo: "Pública", bairro: "Menino Deus", op: "Região 16 - CENTRO", ct: "Micro 2", cadastro: "12/04/2026", cme: "Vigente", doc: [["Regularizada"]] },
  { nome: "Colégio De Aplicação UFRGS", situacao: "Em atividade", cnpj: "19.720.399/0001-03", inep: "31167436", escola: "102", estab: "89", nivel: ["Ens. Fundamental - 1º ao 5º ano | 6º ao 9º ano | EJA", "Ens. Médio"], dep: "Federal", vinculo: "Pública", bairro: "Menino Deus", op: "Região 16 - CENTRO", ct: "Micro 2", cadastro: "12/04/2026", cme: "Não credenciada", doc: [["Vencida", 1]] },
  { nome: "EE Especial Bárbara Sybille Fischinger", situacao: "Em atividade", cnpj: "19.720.399/0001-03", inep: null, escola: "102", estab: "89", nivel: ["Ed. Infantil - Creche | Pré-escola"], mantenedora: true, dep: "Municipal", vinculo: "Pública", bairro: "Menino Deus", op: "Região 16 - CENTRO", ct: "Micro 10", cadastro: "12/04/2026", cme: "Em atraso", doc: [["Pendente", 5], ["Vencida", 1]] },
  { nome: "EEF Aldeia Lumiar", situacao: null, rascunho: true, nivel: ["Ed. Infantil - Creche | Pré-escola"], dep: "Municipal", vinculo: "Pública" },
  { nome: "Esc Técnica Estadual Irmão Pedro", situacao: "Extinta", cnpj: "19.720.399/0001-03", inep: "31167436", escola: "102", estab: "89", nivel: ["Ensino Médio e Técnico"], dep: "Municipal", vinculo: "Pública", bairro: "Menino Deus", op: "Região 16 - CENTRO", ct: "Micro 2", cadastro: "12/04/2026", cme: "Vigente", doc: [["Regularizada"]] },
  { nome: "IEI Mãezinha do Céu", situacao: "Em atividade", cnpj: "19.720.399/0001-03", inep: null, escola: "102", estab: "89", nivel: ["Ed. Infantil - Creche | Pré-escola"], mantenedora: true, dep: "Privada", vinculo: "Judicializada", bairro: "Menino Deus", op: "Região 16 - CENTRO", ct: "Micro 10", cadastro: "12/04/2026", cme: "Em atraso", doc: [["Regularizada"]] },
  { nome: "APAE João Alfredo", situacao: "Paralisada", cnpj: "19.720.399/0001-03", inep: "31167436", escola: "102", estab: "89", nivel: ["Ed. Infantil - Creche | Pré-escola"], mantenedora: true, dep: "Privada", vinculo: "Sem vínculo", bairro: "Menino Deus", op: "Região 16 - CENTRO", ct: "Micro 10", cadastro: "12/04/2026", cme: "Vigente", doc: [["Regularizada"]] },
];
