import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Perfil = 'CLT' | 'Autônomo' | 'Func. Público';

interface Cliente {
  id: number;
  nome: string;
  perfil: Perfil;
  renda: number;
  faixa: string;
  entregues: number;
  total: number;
}

function calcularFaixa(renda: number): string {
  if (renda <= 3200) return '1';
  if (renda <= 5000) return '2';
  if (renda <= 9600) return '3';
  if (renda <= 13000) return '4';
  return 'Fora do MCMV';
}

function getDocsPorPerfil(perfil: Perfil) {
  const comuns = [
    { id: 1, nome: 'RG e CPF', sub: 'Documento de identificação' },
    { id: 2, nome: 'Certidão de Casamento | Nascimento | Óbito', sub: 'Conforme estado civil' },
    { id: 3, nome: 'E-mail', sub: 'Endereço de e-mail ativo' },
    { id: 4, nome: 'Comprovante de residência', sub: 'Últimos 3 meses' },
    { id: 5, nome: 'CTPS', sub: 'Carteira de trabalho' },
    { id: 6, nome: 'Extrato do FGTS', sub: 'Últimos 24 meses' },
    { id: 7, nome: 'Tela do FGTS', sub: 'Print ou cópia da tela' },
  ];

  if (perfil === 'CLT') {
    return [
      ...comuns.slice(0, 3),
      { id: 4, nome: 'Comprovante de renda', sub: 'Últimos 3 holerites' },
      { id: 5, nome: 'Comprovante de residência', sub: 'Últimos 3 meses' },
      { id: 6, nome: 'CTPS', sub: 'Carteira de trabalho' },
      { id: 7, nome: 'Extrato do FGTS', sub: 'Últimos 24 meses' },
      { id: 8, nome: 'Tela do FGTS', sub: 'Print ou cópia da tela' },
    ];
  }

  if (perfil === 'Autônomo') {
    return [
      ...comuns.slice(0, 3),
      { id: 4, nome: '06 últimos extratos bancários', sub: 'De todas as contas' },
      { id: 5, nome: '06 últimas faturas', sub: 'Faturas de cartão ou cobranças' },
      { id: 6, nome: 'Comprovante de residência', sub: 'Últimos 3 meses' },
      { id: 7, nome: 'CTPS', sub: 'Carteira de trabalho' },
      { id: 8, nome: 'Extrato do FGTS', sub: 'Últimos 24 meses' },
      { id: 9, nome: 'Tela do FGTS', sub: 'Print ou cópia da tela' },
      { id: 10, nome: 'Imposto de renda', sub: 'Se declarar' },
    ];
  }

  if (perfil === 'Func. Público') {
    return [
      ...comuns.slice(0, 3),
      { id: 4, nome: '03 últimos comprovantes de renda', sub: 'Contracheques' },
      { id: 5, nome: 'Contrato ou termo de posse', sub: 'Documento de vínculo com o órgão' },
      { id: 6, nome: 'CTPS', sub: 'Carteira de trabalho' },
      { id: 7, nome: 'Comprovante de residência', sub: 'Últimos 3 meses' },
      { id: 8, nome: 'Imposto de renda', sub: 'Se declarar' },
    ];
  }

  return comuns;
}

const clientesIniciais: Cliente[] = [
  { id: 1, nome: 'Maria da Silva', perfil: 'CLT', renda: 3200, faixa: calcularFaixa(3200), total: 8, entregues: 4 },
  { id: 2, nome: 'José Oliveira', perfil: 'Autônomo', renda: 1800, faixa: calcularFaixa(1800), total: 10, entregues: 6 },
  { id: 3, nome: 'Ana Mendes', perfil: 'CLT', renda: 5000, faixa: calcularFaixa(5000), total: 8, entregues: 8 },
];

export default function HomeScreen() {
  const [tela, setTela] = useState('lista');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente>(clientesIniciais[0]);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [novoNome, setNovoNome] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<Perfil>('CLT');
  const [novaRenda, setNovaRenda] = useState('');

  const faixaPreview = novaRenda ? calcularFaixa(parseFloat(novaRenda.replace(',', '.'))) : null;

  useEffect(() => {
    carregarClientes();
  }, []);

  async function carregarClientes() {
    try {
      const dados = await AsyncStorage.getItem('clientes');
      if (dados) {
        setClientes(JSON.parse(dados));
      } else {
        setClientes(clientesIniciais);
        await AsyncStorage.setItem('clientes', JSON.stringify(clientesIniciais));
      }
    } catch (e) {
      setClientes(clientesIniciais);
    } finally {
      setCarregando(false);
    }
  }

  async function salvarClientes(lista: Cliente[]) {
    try {
      await AsyncStorage.setItem('clientes', JSON.stringify(lista));
    } catch (e) {
      console.log('Erro ao salvar:', e);
    }
  }

  function abrirCliente(cliente: Cliente) {
    setClienteSelecionado(cliente);
    setTela('checklist');
  }

  function adicionarCliente() {
    if (!novoNome.trim() || !novaRenda.trim()) return;
    const renda = parseFloat(novaRenda.replace(',', '.'));
    if (isNaN(renda) || renda <= 0) return;
    const faixa = calcularFaixa(renda);
    const docs = getDocsPorPerfil(novoPerfil);
    const novo: Cliente = {
      id: Date.now(),
      nome: novoNome.trim(),
      perfil: novoPerfil,
      renda,
      faixa,
      total: docs.length,
      entregues: 0,
    };
    const novaLista = [...clientes, novo];
    setClientes(novaLista);
    salvarClientes(novaLista);
    setNovoNome('');
    setNovoPerfil('CLT');
    setNovaRenda('');
    setModalAberto(false);
  }

  function atualizarEntregues(id: number, entregues: number) {
    const novaLista = clientes.map(c => c.id === id ? { ...c, entregues } : c);
    setClientes(novaLista);
    salvarClientes(novaLista);
  }

  if (carregando) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#888', fontSize: 15 }}>Carregando...</Text>
      </View>
    );
  }

  if (tela === 'checklist') {
    return (
      <ChecklistScreen
        cliente={clienteSelecionado}
        voltar={() => setTela('lista')}
        onAtualizar={(entregues) => atualizarEntregues(clienteSelecionado.id, entregues)}
      />
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerTitulo}>Meus Clientes</Text>
            <Text style={s.headerSub}>MCMV — Checklist de Documentação</Text>
          </View>
          <TouchableOpacity style={s.btnNovo} onPress={() => setModalAberto(true)}>
            <Text style={s.btnNovoTexto}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll}>
        <Text style={s.secao}>Clientes ({clientes.length})</Text>
        {clientes.map(c => {
          const pct = Math.round((c.entregues / c.total) * 100);
          const foraDoMCMV = c.faixa === 'Fora do MCMV';
          return (
            <TouchableOpacity key={c.id} style={s.card} onPress={() => abrirCliente(c)}>
              <View style={s.avatar}>
                <Text style={s.avatarTexto}>
                  {c.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardNome}>{c.nome}</Text>
                <Text style={s.cardPerfil}>
                  {c.perfil} · {foraDoMCMV ? 'Fora do MCMV' : `Faixa ${c.faixa}`} · {c.total - c.entregues} pendentes
                </Text>
              </View>
              <Text style={[s.pct, pct === 100 && { color: '#2ecc71' }, foraDoMCMV && { color: '#e74c3c' }]}>
                {foraDoMCMV ? '—' : `${pct}%`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={modalAberto} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>Novo Cliente</Text>

            <Text style={s.label}>Nome completo</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: João da Silva"
              value={novoNome}
              onChangeText={setNovoNome}
              placeholderTextColor="#aaa"
            />

            <Text style={s.label}>Perfil profissional</Text>
            <View style={s.opcoes}>
              {(['CLT', 'Autônomo', 'Func. Público'] as Perfil[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[s.opcao, novoPerfil === p && s.opcaoAtiva]}
                  onPress={() => setNovoPerfil(p)}
                >
                  <Text style={[s.opcaoTexto, novoPerfil === p && s.opcaoTextoAtivo]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Renda familiar (R$)</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: 3200"
              value={novaRenda}
              onChangeText={setNovaRenda}
              keyboardType="numeric"
              placeholderTextColor="#aaa"
            />

            {faixaPreview && (
              <View style={[s.faixaBox, faixaPreview === 'Fora do MCMV' ? s.faixaBoxErro : s.faixaBoxOk]}>
                <Text style={[s.faixaTexto, faixaPreview === 'Fora do MCMV' ? s.faixaTextoErro : s.faixaTextoOk]}>
                  {faixaPreview === 'Fora do MCMV'
                    ? 'Renda acima do limite do MCMV (R$ 13.000)'
                    : `Faixa ${faixaPreview} — cliente elegivel ao MCMV`}
                </Text>
              </View>
            )}

            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => setModalAberto(false)}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSalvar} onPress={adicionarCliente}>
                <Text style={s.btnSalvarTexto}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ChecklistScreen({ cliente, voltar, onAtualizar }: {
  cliente: Cliente;
  voltar: () => void;
  onAtualizar: (entregues: number) => void;
}) {
  const docs = getDocsPorPerfil(cliente.perfil).map((d, i) => ({
    ...d,
    entregue: cliente.entregues > i,
  }));

  const [status, setStatus] = useState(docs.map(d => d.entregue));
  const entregues = status.filter(Boolean).length;
  const pct = Math.round((entregues / docs.length) * 100);

  function toggle(i: number) {
    const novo = [...status];
    novo[i] = !novo[i];
    setStatus(novo);
    onAtualizar(novo.filter(Boolean).length);
  }

  function enviarWhatsApp() {
    const pendentes = docs.filter((_, i) => !status[i]).map(d => `- ${d.nome}`);
    if (pendentes.length === 0) {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`Ola ${cliente.nome}! Todos os seus documentos ja foram entregues. Em breve entraremos em contato com os proximos passos do seu financiamento pelo MCMV.`)}`);
      return;
    }
    const mensagem =
      `Ola ${cliente.nome}, tudo bem?\n\n` +
      `Estou verificando a documentacao do seu financiamento pelo Minha Casa, Minha Vida e ainda precisamos dos seguintes documentos:\n\n` +
      `${pendentes.join('\n')}\n\n` +
      `Assim que tiver, pode me enviar por aqui mesmo ou trazer pessoalmente. Qualquer duvida estou a disposicao.`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(mensagem)}`);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={voltar}>
          <Text style={s.voltar}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitulo}>{cliente.nome}</Text>
        <Text style={s.headerSub}>
          {cliente.perfil} · Faixa {cliente.faixa} · Renda R$ {cliente.renda.toLocaleString('pt-BR')}
        </Text>
        <View style={s.barraFundo}>
          <View style={[s.barraFill, { width: `${pct}%` as any }]} />
        </View>
        <View style={s.barraLabels}>
          <Text style={s.barraTexto}>{entregues} de {docs.length} entregues</Text>
          <Text style={s.barraTexto}>{pct}%</Text>
        </View>
      </View>

      <ScrollView style={s.scroll}>
        <Text style={s.secao}>Documentos</Text>
        {docs.map((doc, i) => (
          <TouchableOpacity key={doc.id} style={s.docItem} onPress={() => toggle(i)}>
            <View style={[s.circulo, status[i] && s.circuloOk]}>
              {status[i] && <Text style={s.check}>✓</Text>}
            </View>
            <View style={s.docInfo}>
              <Text style={s.docNome}>{doc.nome}</Text>
              <Text style={s.docSub}>{doc.sub}</Text>
            </View>
            <View style={[s.badge, status[i] ? s.badgeOk : s.badgePend]}>
              <Text style={[s.badgeTexto, status[i] ? s.badgeTextoOk : s.badgeTextoPend]}>
                {status[i] ? 'Entregue' : 'Pendente'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.btnWhatsApp} onPress={enviarWhatsApp}>
          <Text style={s.btnWhatsAppTexto}>
            {entregues === docs.length ? 'Enviar parabens ao cliente' : 'Enviar pendencias pelo WhatsApp'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#1a5276', padding: 20, paddingTop: 60 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitulo: { color: '#fff', fontSize: 20, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  voltar: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 8 },
  btnNovo: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  btnNovoTexto: { color: '#fff', fontSize: 13, fontWeight: '500' },
  barraFundo: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, height: 6, marginTop: 14 },
  barraFill: { backgroundColor: '#2ecc71', borderRadius: 10, height: 6 },
  barraLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barraTexto: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  scroll: { padding: 16 },
  secao: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 6 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#d6eaf8', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 13, fontWeight: '600', color: '#1a5276' },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 14, fontWeight: '600', color: '#222' },
  cardPerfil: { fontSize: 12, color: '#888', marginTop: 2 },
  pct: { fontSize: 13, fontWeight: '600', color: '#1a5276' },
  docItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  circulo: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  circuloOk: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  check: { color: '#fff', fontSize: 13, fontWeight: '700' },
  docInfo: { flex: 1 },
  docNome: { fontSize: 13, fontWeight: '600', color: '#222' },
  docSub: { fontSize: 11, color: '#888', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOk: { backgroundColor: '#eafaf1' },
  badgePend: { backgroundColor: '#fef9e7' },
  badgeTexto: { fontSize: 11, fontWeight: '500' },
  badgeTextoOk: { color: '#1e8449' },
  badgeTextoPend: { color: '#d68910' },
  btnWhatsApp: { backgroundColor: '#25D366', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  btnWhatsAppTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { fontSize: 18, fontWeight: '600', color: '#222', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#222' },
  opcoes: { flexDirection: 'row', gap: 8 },
  opcao: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  opcaoAtiva: { backgroundColor: '#1a5276', borderColor: '#1a5276' },
  opcaoTexto: { fontSize: 11, color: '#555', fontWeight: '500' },
  opcaoTextoAtivo: { color: '#fff' },
  faixaBox: { marginTop: 10, padding: 10, borderRadius: 10 },
  faixaBoxOk: { backgroundColor: '#eafaf1' },
  faixaBoxErro: { backgroundColor: '#fdedec' },
  faixaTexto: { fontSize: 13, fontWeight: '500' },
  faixaTextoOk: { color: '#1e8449' },
  faixaTextoErro: { color: '#c0392b' },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  btnCancelarTexto: { color: '#888', fontWeight: '500' },
  btnSalvar: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1a5276', alignItems: 'center' },
  btnSalvarTexto: { color: '#fff', fontWeight: '600' },
});