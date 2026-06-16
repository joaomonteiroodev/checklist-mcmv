import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

// ─── CORES CERTUS ─────────────────────────────────────────────────────────────
const C = {
  verde: '#1A3C34',
  dourado: '#C9A84C',
  bege: '#F5F0E8',
  begeCard: '#FFFFFF',
  verdeMedio: '#1D9E75',
  verdeClaro: '#E1F5EE',
  cinza: '#888780',
  cinzaClaro: '#F0EDE8',
  texto: '#2C2C2A',
  textoSub: '#5F5E5A',
  erro: '#993C1D',
  erroClaro: '#FAECE7',
};

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type Perfil = 'CLT' | 'Autônomo' | 'Func. Público';
type Aba = 'clientes' | 'dashboard' | 'configuracoes';

interface Documento {
  id: number;
  nome: string;
  sub: string;
  entregue: boolean;
  observacao: string;
  arquivoBase64?: string;
  arquivoNome?: string;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  perfil: Perfil;
  renda: number;
  faixa: string;
  empreendimento: string;
  docs: Documento[];
  corretorId: string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcularFaixa(renda: number): string {
  if (renda <= 3200) return '1';
  if (renda <= 5000) return '2';
  if (renda <= 9600) return '3';
  if (renda <= 13000) return '4';
  return 'Fora do MCMV';
}

function getDocsPorPerfil(perfil: Perfil): Omit<Documento, 'entregue' | 'observacao'>[] {
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

function inicializarDocs(perfil: Perfil): Documento[] {
  return getDocsPorPerfil(perfil).map(d => ({ ...d, entregue: false, observacao: '' }));
}

function formatarTelefoneWA(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

function traduzirErroAuth(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'E-mail inválido.';
    case 'auth/user-not-found': return 'Usuário não encontrado.';
    case 'auth/wrong-password': return 'Senha incorreta.';
    case 'auth/invalid-credential': return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado.';
    case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/missing-password': return 'Digite uma senha.';
    default: return 'Erro ao autenticar: ' + code;
  }
}

// ─── RAIZ ─────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (authLoading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.cinza, fontSize: 15 }}>Carregando...</Text>
      </View>
    );
  }

  if (!user) return <LoginScreen />;
  return <AppPrincipal user={user} />;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modoCadastro, setModoCadastro] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [senhaEnviada, setSenhaEnviada] = useState(false);

  async function recuperarSenha() {
    if (!email.trim()) { setErro('Digite seu e-mail para recuperar a senha.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSenhaEnviada(true);
      setErro('');
    } catch (e: any) { setErro(traduzirErroAuth(e.code || '')); }
  }

  async function entrar() {
    if (!email.trim() || !senha.trim()) { setErro('Preencha e-mail e senha.'); return; }
    setErro(''); setCarregando(true);
    try {
      if (modoCadastro) await createUserWithEmailAndPassword(auth, email.trim(), senha);
      else await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (e: any) {
      setErro(traduzirErroAuth(e.code || ''));
    } finally { setCarregando(false); }
  }

  return (
    <View style={s.loginContainer}>
      {/* Topo verde com logo */}
      <View style={s.loginTopo}>
        <View style={s.loginLogoBox}>
          <Text style={s.loginLogoIcon}>✓</Text>
        </View>
        <Text style={s.loginNomeApp}>Certus</Text>
        <Text style={s.loginTagline}>Documentação MCMV simplificada</Text>
      </View>

      {/* Card branco */}
      <View style={s.loginCard}>
        <Text style={s.loginCardTitulo}>
          {modoCadastro ? 'Criar conta' : 'Bem-vindo de volta'}
        </Text>
        <Text style={s.loginCardSub}>
          {modoCadastro ? 'Preencha os dados para começar' : 'Entre com sua conta de corretor'}
        </Text>

        <Text style={s.label}>E-mail</Text>
        <TextInput
          style={s.input}
          placeholder="seuemail@exemplo.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={C.cinza}
        />

        <Text style={s.label}>Senha</Text>
        <TextInput
          style={s.input}
          placeholder="Mínimo 6 caracteres"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          placeholderTextColor={C.cinza}
        />

        {erro ? <Text style={s.loginErro}>{erro}</Text> : null}
        {senhaEnviada ? (
          <Text style={{ color: C.verdeMedio, fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            E-mail de recuperação enviado!
          </Text>
        ) : null}

        <TouchableOpacity
          style={[s.loginBotao, carregando && { opacity: 0.6 }]}
          onPress={entrar}
          disabled={carregando}
        >
          <Text style={s.loginBotaoTexto}>
            {carregando ? 'Aguarde...' : modoCadastro ? 'Criar conta' : 'Entrar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setModoCadastro(!modoCadastro); setErro(''); }}
          style={{ marginTop: 14, alignItems: 'center' }}
        >
          <Text style={{ color: C.verde, fontSize: 13, fontWeight: '500' }}>
            {modoCadastro ? 'Já tenho conta — Entrar' : 'Não tenho conta — Criar conta'}
          </Text>
        </TouchableOpacity>

        {!modoCadastro && (
          <TouchableOpacity onPress={recuperarSenha} style={{ marginTop: 10, alignItems: 'center' }}>
            <Text style={{ color: C.cinza, fontSize: 12 }}>Esqueceu a senha?</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.loginRodape}>Certus © 2026 · Todos os direitos reservados</Text>
    </View>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function AppPrincipal({ user }: { user: User }) {
  const [tela, setTela] = useState<'lista' | 'checklist'>('lista');
  const [abaAtiva, setAbaAtiva] = useState<Aba>('clientes');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<Perfil>('CLT');
  const [novaRenda, setNovaRenda] = useState('');
  const [novoEmpreendimento, setNovoEmpreendimento] = useState('');
  const [modalExcluirCliente, setModalExcluirCliente] = useState<Cliente | null>(null);

  const faixaPreview = novaRenda ? calcularFaixa(parseFloat(novaRenda.replace(',', '.'))) : null;

  useEffect(() => {
    const q = query(collection(db, 'clientes'), where('corretorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Cliente[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Cliente, 'id'>) }));
      setClientes(lista);
      setCarregando(false);
    }, () => setCarregando(false));
    return unsubscribe;
  }, [user.uid]);

  function abrirCliente(cliente: Cliente) {
    setClienteSelecionado(cliente);
    setTela('checklist');
  }

  async function adicionarCliente() {
    if (!novoNome.trim() || !novaRenda.trim()) return;
    const renda = parseFloat(novaRenda.replace(',', '.'));
    if (isNaN(renda) || renda <= 0) return;
    try {
      await addDoc(collection(db, 'clientes'), {
        nome: novoNome.trim(), telefone: novoTelefone.trim(),
        perfil: novoPerfil, renda, faixa: calcularFaixa(renda),
        empreendimento: novoEmpreendimento.trim(),
        docs: inicializarDocs(novoPerfil), corretorId: user.uid,
      });
    } catch { alert('Erro ao salvar cliente.'); }
    setNovoNome(''); setNovoTelefone(''); setNovoPerfil('CLT');
    setNovaRenda(''); setNovoEmpreendimento(''); setModalAberto(false);
  }

  async function excluirCliente(cliente: Cliente) {
    try { await deleteDoc(doc(db, 'clientes', cliente.id)); } catch { alert('Erro ao excluir.'); }
    setModalExcluirCliente(null);
  }

  async function atualizarCliente(clienteAtualizado: Cliente) {
    const { id, ...dados } = clienteAtualizado;
    setClienteSelecionado(clienteAtualizado);
    try { await updateDoc(doc(db, 'clientes', id), dados); } catch { alert('Erro ao salvar.'); }
  }

  if (carregando) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.cinza }}>Carregando...</Text>
      </View>
    );
  }

  if (tela === 'checklist' && clienteSelecionado) {
    return (
      <ChecklistScreen
        cliente={clienteSelecionado}
        voltar={() => setTela('lista')}
        onAtualizar={atualizarCliente}
        onExcluir={(c) => { excluirCliente(c); setTela('lista'); }}
      />
    );
  }

  return (
    <View style={s.container}>
      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={s.logoRow}>
            <View style={s.logoMark}><Text style={s.logoIcon}>✓</Text></View>
            <View>
              <Text style={s.headerTitulo}>Certus</Text>
              <Text style={s.headerSub}>Documentação MCMV</Text>
            </View>
          </View>
        </View>
        {abaAtiva === 'clientes' && (
          <View style={s.progressoGeral}>
            <Text style={s.progressoLabel}>
              {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} ativos
            </Text>
            <Text style={s.progressoMedia}>
              {clientes.length > 0
                ? `Média: ${Math.round(clientes.reduce((acc, c) => {
                    const e = c.docs.filter(d => d.entregue).length;
                    return acc + (c.docs.length > 0 ? e / c.docs.length : 0);
                  }, 0) / clientes.length * 100)}% concluído`
                : 'Nenhum cliente ainda'}
            </Text>
          </View>
        )}
        {abaAtiva === 'dashboard' && (
          <Text style={[s.headerSub, { marginTop: 4 }]}>Visão geral da carteira</Text>
        )}
        {abaAtiva === 'configuracoes' && (
          <Text style={[s.headerSub, { marginTop: 4 }]}>Gerencie sua conta</Text>
        )}
      </View>

      {/* CONTEÚDO */}
      <View style={{ flex: 1 }}>
        {abaAtiva === 'clientes' && (
          <TelaClientes
            clientes={clientes}
            onAbrirCliente={abrirCliente}
            onExcluirCliente={setModalExcluirCliente}
          />
        )}
        {abaAtiva === 'dashboard' && <TelaDashboard clientes={clientes} />}
        {abaAtiva === 'configuracoes' && <TelaConfiguracoes user={user} />}
      </View>

      {/* FAB — botão flutuante */}
      {abaAtiva === 'clientes' && (
        <TouchableOpacity style={s.fab} onPress={() => setModalAberto(true)}>
          <Text style={s.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* NAVBAR */}
      <View style={s.navbar}>
        {([
          { key: 'clientes', label: 'Clientes', icon: '👥' },
          { key: 'dashboard', label: 'Dashboard', icon: '📊' },
          { key: 'configuracoes', label: 'Config.', icon: '⚙️' },
        ] as { key: Aba; label: string; icon: string }[]).map(item => (
          <TouchableOpacity
            key={item.key}
            style={s.navItem}
            onPress={() => setAbaAtiva(item.key)}
          >
            <Text style={[s.navIcon, abaAtiva === item.key && s.navIconAtivo]}>{item.icon}</Text>
            <Text style={[s.navLabel, abaAtiva === item.key && s.navLabelAtivo]}>{item.label}</Text>
            {abaAtiva === item.key && <View style={s.navDot} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal Novo Cliente */}
      <Modal visible={modalAberto} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>Novo Cliente</Text>
            <Text style={s.label}>Nome completo</Text>
            <TextInput style={s.input} placeholder="Ex: João da Silva" value={novoNome} onChangeText={setNovoNome} placeholderTextColor={C.cinza} />
            <Text style={s.label}>Telefone (WhatsApp)</Text>
            <TextInput style={s.input} placeholder="Ex: 81999990000" value={novoTelefone} onChangeText={setNovoTelefone} keyboardType="phone-pad" placeholderTextColor={C.cinza} />
            <Text style={s.label}>Empreendimento</Text>
            <TextInput style={s.input} placeholder="Ex: Mirante Belvedere" value={novoEmpreendimento} onChangeText={setNovoEmpreendimento} placeholderTextColor={C.cinza} />
            <Text style={s.label}>Perfil profissional</Text>
            <View style={s.opcoes}>
              {(['CLT', 'Autônomo', 'Func. Público'] as Perfil[]).map(p => (
                <TouchableOpacity key={p} style={[s.opcao, novoPerfil === p && s.opcaoAtiva]} onPress={() => setNovoPerfil(p)}>
                  <Text style={[s.opcaoTexto, novoPerfil === p && s.opcaoTextoAtivo]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Renda familiar (R$)</Text>
            <TextInput style={s.input} placeholder="Ex: 3200" value={novaRenda} onChangeText={setNovaRenda} keyboardType="numeric" placeholderTextColor={C.cinza} />
            {faixaPreview && (
              <View style={[s.faixaBox, faixaPreview === 'Fora do MCMV' ? s.faixaBoxErro : s.faixaBoxOk]}>
                <Text style={[s.faixaTexto, faixaPreview === 'Fora do MCMV' ? s.faixaTextoErro : s.faixaTextoOk]}>
                  {faixaPreview === 'Fora do MCMV' ? 'Renda acima do limite do MCMV (R$ 13.000)' : `Faixa ${faixaPreview} — cliente elegível ao MCMV`}
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

      {/* Modal Excluir */}
      <Modal visible={modalExcluirCliente !== null} animationType="fade" transparent>
        <View style={s.modalFundo}>
          <View style={[s.modalBox, { paddingBottom: 30 }]}>
            <Text style={s.modalTitulo}>Excluir cliente?</Text>
            <Text style={{ color: C.textoSub, fontSize: 14, marginBottom: 8 }}>
              Tem certeza que deseja excluir <Text style={{ fontWeight: '600' }}>{modalExcluirCliente?.nome}</Text>?
            </Text>
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => setModalExcluirCliente(null)}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnSalvar, { backgroundColor: C.erro }]} onPress={() => modalExcluirCliente && excluirCliente(modalExcluirCliente)}>
                <Text style={s.btnSalvarTexto}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── ABA CLIENTES ─────────────────────────────────────────────────────────────
function TelaClientes({ clientes, onAbrirCliente, onExcluirCliente }: {
  clientes: Cliente[];
  onAbrirCliente: (c: Cliente) => void;
  onExcluirCliente: (c: Cliente) => void;
}) {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={s.secao}>Clientes ({clientes.length})</Text>
      {clientes.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>📋</Text>
          <Text style={{ color: C.cinza, fontSize: 14, textAlign: 'center' }}>
            Nenhum cliente ainda.{'\n'}Toque no + para adicionar.
          </Text>
        </View>
      )}
      {clientes.map(c => {
        const entregues = c.docs.filter(d => d.entregue).length;
        const total = c.docs.length;
        const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;
        const pendentes = total - entregues;
        const fora = c.faixa === 'Fora do MCMV';
        const iniciais = c.nome.split(' ').map(n => n[0]).slice(0, 2).join('');
        return (
          <View key={c.id} style={s.cardWrapper}>
            <TouchableOpacity style={s.card} onPress={() => onAbrirCliente(c)}>
              <View style={s.avatar}>
                <Text style={s.avatarTexto}>{iniciais}</Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardNome}>{c.nome}</Text>
                <Text style={s.cardPerfil}>
                  {c.perfil} · {fora ? 'Fora do MCMV' : `Faixa ${c.faixa}`} · {pendentes} pendentes
                </Text>
                {c.empreendimento ? <Text style={s.cardEmpreendimento}>🏢 {c.empreendimento}</Text> : null}
                {/* mini barra */}
                <View style={{ height: 3, backgroundColor: C.verdeClaro, borderRadius: 2, marginTop: 6 }}>
                  <View style={{ height: 3, backgroundColor: pct === 100 ? C.verdeMedio : C.dourado, borderRadius: 2, width: `${pct}%` as any }} />
                </View>
              </View>
              <Text style={[s.pct, pct === 100 && { color: C.verdeMedio }, fora && { color: C.erro }]}>
                {fora ? '—' : `${pct}%`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnExcluirCard} onPress={() => onExcluirCliente(c)}>
              <Text style={s.btnExcluirCardTexto}>🗑</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── ABA DASHBOARD ────────────────────────────────────────────────────────────
function TelaDashboard({ clientes }: { clientes: Cliente[] }) {
  const total = clientes.length;
  const prontos = clientes.filter(c => c.docs.every(d => d.entregue)).length;
  const pendentes = clientes.filter(c => c.docs.some(d => !d.entregue)).length;
  const mediaPct = total > 0
    ? Math.round(clientes.reduce((acc, c) => {
        const e = c.docs.filter(d => d.entregue).length;
        return acc + (c.docs.length > 0 ? e / c.docs.length : 0);
      }, 0) / total * 100)
    : 0;

  const porFaixa = ['1', '2', '3', '4', 'Fora do MCMV'].map(f => ({
    faixa: f,
    count: clientes.filter(c => c.faixa === f).length,
  })).filter(f => f.count > 0);

  const topClientes = [...clientes]
    .map(c => {
      const e = c.docs.filter(d => d.entregue).length;
      const pct = c.docs.length > 0 ? Math.round(e / c.docs.length * 100) : 0;
      return { ...c, pct };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.secao}>Resumo</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        {[
          { num: total, label: 'Total de clientes' },
          { num: `${mediaPct}%`, label: 'Média geral' },
        ].map((item, i) => (
          <View key={i} style={s.statCard}>
            <Text style={s.statNum}>{item.num}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { num: prontos, label: 'Prontos p/ envio', cor: C.verdeMedio },
          { num: pendentes, label: 'Com pendências', cor: C.dourado },
        ].map((item, i) => (
          <View key={i} style={s.statCard}>
            <Text style={[s.statNum, { color: item.cor }]}>{item.num}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {porFaixa.length > 0 && (
        <>
          <Text style={s.secao}>Distribuição por faixa</Text>
          {porFaixa.map(f => (
            <View key={f.faixa} style={[s.card, { marginBottom: 8, paddingVertical: 10 }]}>
              <Text style={{ fontSize: 13, color: C.texto, fontWeight: '500' }}>
                {f.faixa === 'Fora do MCMV' ? 'Fora do MCMV' : `Faixa ${f.faixa}`}
              </Text>
              <View style={{ flex: 1, marginHorizontal: 12, height: 4, backgroundColor: C.verdeClaro, borderRadius: 2 }}>
                <View style={{ height: 4, backgroundColor: C.verde, borderRadius: 2, width: `${Math.round(f.count / total * 100)}%` as any }} />
              </View>
              <Text style={{ fontSize: 13, color: C.cinza }}>{f.count}</Text>
            </View>
          ))}
        </>
      )}

      {topClientes.length > 0 && (
        <>
          <Text style={[s.secao, { marginTop: 8 }]}>Mais avançados</Text>
          {topClientes.map((c, i) => (
            <View key={c.id} style={[s.card, { marginBottom: 8, paddingVertical: 10 }]}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.dourado, width: 24 }}>{i + 1}°</Text>
              <View style={s.avatar}>
                <Text style={s.avatarTexto}>{c.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.cardNome}>{c.nome}</Text>
                <Text style={s.cardPerfil}>{c.empreendimento || c.perfil}</Text>
              </View>
              <Text style={[s.pct, c.pct === 100 && { color: C.verdeMedio }]}>{c.pct}%</Text>
            </View>
          ))}
        </>
      )}

      {total === 0 && (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>📊</Text>
          <Text style={{ color: C.cinza, fontSize: 14, textAlign: 'center' }}>
            Adicione clientes para ver{'\n'}as métricas aqui.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── ABA CONFIGURAÇÕES ────────────────────────────────────────────────────────
function TelaConfiguracoes({ user }: { user: User }) {
  const [novaSenha, setNovaSenha] = useState('');
  const [modalSenha, setModalSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState(false);
  const [notifPendencias, setNotifPendencias] = useState(true);

  async function alterarSenha() {
    if (novaSenha.length < 6) { setErroSenha('Mínimo 6 caracteres.'); return; }
    try {
      await updatePassword(user, novaSenha);
      setSucessoSenha(true);
      setNovaSenha('');
      setTimeout(() => { setModalSenha(false); setSucessoSenha(false); }, 1500);
    } catch { setErroSenha('Erro ao alterar. Faça login novamente.'); }
  }

  const iniciais = user.email?.slice(0, 2).toUpperCase() || 'JM';

  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Perfil */}
      <View style={s.configPerfilCard}>
        <View style={[s.avatar, { width: 50, height: 50, borderRadius: 25 }]}>
          <Text style={[s.avatarTexto, { fontSize: 16 }]}>{iniciais}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.texto }}>{user.email}</Text>
          <View style={s.badgeCor}>
            <Text style={s.badgeTexto}>Corretor ativo</Text>
          </View>
        </View>
      </View>

      <Text style={s.secao}>Conta</Text>
      <View style={s.configCard}>
        <TouchableOpacity style={s.configItem} onPress={() => setModalSenha(true)}>
          <Text style={s.configItemIcon}>🔒</Text>
          <View>
            <Text style={s.configItemLabel}>Alterar senha</Text>
            <Text style={s.configItemSub}>Mantenha sua conta segura</Text>
          </View>
          <Text style={s.configSeta}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.secao}>Notificações</Text>
      <View style={s.configCard}>
        <View style={s.configItem}>
          <Text style={s.configItemIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.configItemLabel}>Lembretes de pendências</Text>
          </View>
          <TouchableOpacity
            style={[s.toggle, notifPendencias ? s.toggleOn : s.toggleOff]}
            onPress={() => setNotifPendencias(!notifPendencias)}
          >
            <View style={s.toggleDot} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.secao}>Imobiliária</Text>
      <View style={s.configCard}>
        <View style={s.configItem}>
          <Text style={s.configItemIcon}>🏢</Text>
          <View>
            <Text style={s.configItemLabel}>Logo da imobiliária</Text>
            <Text style={s.configItemSub}>Em breve</Text>
          </View>
          <Text style={s.configSeta}>›</Text>
        </View>
        <View style={[s.configItem, { borderBottomWidth: 0 }]}>
          <Text style={s.configItemIcon}>🎨</Text>
          <View>
            <Text style={s.configItemLabel}>Cor da marca</Text>
            <Text style={s.configItemSub}>Verde Certus (padrão)</Text>
          </View>
          <Text style={s.configSeta}>›</Text>
        </View>
      </View>

      <TouchableOpacity style={s.btnLogout} onPress={() => signOut(auth)}>
        <Text style={s.btnLogoutTexto}>Sair da conta</Text>
      </TouchableOpacity>

      {/* Modal alterar senha */}
      <Modal visible={modalSenha} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>Alterar senha</Text>
            <Text style={s.label}>Nova senha</Text>
            <TextInput
              style={s.input}
              placeholder="Mínimo 6 caracteres"
              value={novaSenha}
              onChangeText={setNovaSenha}
              secureTextEntry
              placeholderTextColor={C.cinza}
            />
            {erroSenha ? <Text style={{ color: C.erro, fontSize: 13, marginTop: 8 }}>{erroSenha}</Text> : null}
            {sucessoSenha ? <Text style={{ color: C.verdeMedio, fontSize: 13, marginTop: 8 }}>Senha alterada com sucesso!</Text> : null}
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => { setModalSenha(false); setErroSenha(''); }}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSalvar} onPress={alterarSenha}>
                <Text style={s.btnSalvarTexto}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── TELA CHECKLIST ───────────────────────────────────────────────────────────

// ─── CHECKLIST ────────────────────────────────────────────────────────────────
function ChecklistScreen({ cliente, voltar, onAtualizar, onExcluir }: {
  cliente: Cliente;
  voltar: () => void;
  onAtualizar: (c: Cliente) => void;
  onExcluir: (c: Cliente) => void;
}) {
  const entregues = cliente.docs.filter(d => d.entregue).length;
  const total = cliente.docs.length;
  const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;

  function toggleDoc(id: number) {
    const novosDocs = cliente.docs.map(d =>
      d.id === id ? { ...d, entregue: !d.entregue } : d
    );
    onAtualizar({ ...cliente, docs: novosDocs });
  }

  function salvarObs(id: number, obs: string) {
    const novosDocs = cliente.docs.map(d =>
      d.id === id ? { ...d, observacao: obs } : d
    );
    onAtualizar({ ...cliente, docs: novosDocs });
  }

  const waLink = `https://wa.me/${formatarTelefoneWA(cliente.telefone)}`;

  return (
    <View style={s.container}>
      {/* Header checklist */}
      <View style={s.header}>
        <TouchableOpacity onPress={voltar} style={s.btnVoltar}>
          <Text style={s.btnVoltarTexto}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={s.checklistNome}>{cliente.nome}</Text>
        <Text style={s.checklistSub}>
          {cliente.perfil} · {cliente.faixa === 'Fora do MCMV' ? 'Fora do MCMV' : `Faixa ${cliente.faixa}`}
          {cliente.empreendimento ? ` · ${cliente.empreendimento}` : ''}
        </Text>
        {/* Barra de progresso */}
        <View style={s.progressoBox}>
          <View style={s.progressoBarFundo}>
            <View style={[s.progressoBarFill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? C.verdeMedio : C.dourado }]} />
          </View>
          <Text style={s.progressoPct}>{pct}%</Text>
        </View>
        <Text style={s.progressoContador}>{entregues} de {total} documentos entregues</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 120 }}>
        {cliente.docs.map(doc => (
          <DocItem key={doc.id} doc={doc} onToggle={toggleDoc} onSalvarObs={salvarObs} />
        ))}

        {/* Ações */}
        <View style={{ marginTop: 16, gap: 10 }}>
          {cliente.telefone ? (
            <TouchableOpacity style={s.btnWA} onPress={() => Linking.openURL(waLink)}>
              <Text style={s.btnWATexto}>📱 Abrir WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[s.btnSalvar, { backgroundColor: C.erro, marginHorizontal: 0 }]}
            onPress={() => onExcluir(cliente)}
          >
            <Text style={s.btnSalvarTexto}>🗑 Excluir cliente</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── ITEM DE DOCUMENTO ────────────────────────────────────────────────────────
function DocItem({ doc, onToggle, onSalvarObs }: {
  doc: Documento;
  onToggle: (id: number) => void;
  onSalvarObs: (id: number, obs: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [obs, setObs] = useState(doc.observacao || '');

  return (
    <View style={[s.docCard, doc.entregue && s.docCardEntregue]}>
      <TouchableOpacity style={s.docRow} onPress={() => setExpandido(!expandido)}>
        <TouchableOpacity style={s.checkbox} onPress={() => onToggle(doc.id)}>
          <View style={[s.checkboxBox, doc.entregue && s.checkboxBoxAtivo]}>
            {doc.entregue && <Text style={s.checkboxCheck}>✓</Text>}
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.docNome, doc.entregue && s.docNomeEntregue]}>{doc.nome}</Text>
          <Text style={s.docSub}>{doc.sub}</Text>
        </View>
        {!doc.entregue && (
          <View style={s.badgePendente}>
            <Text style={s.badgePendenteTexto}>Pendente</Text>
          </View>
        )}
        <Text style={s.expandIcon}>{expandido ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandido && (
        <View style={s.obsBox}>
          <Text style={s.obsLabel}>Observação</Text>
          <TextInput
            style={s.obsInput}
            placeholder="Ex: Cliente vai enviar na segunda-feira"
            value={obs}
            onChangeText={setObs}
            multiline
            placeholderTextColor={C.cinza}
          />
          <TouchableOpacity style={s.obsSalvar} onPress={() => onSalvarObs(doc.id, obs)}>
            <Text style={s.obsSalvarTexto}>Salvar observação</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bege },

  // LOGIN
  loginContainer: { flex: 1, backgroundColor: C.verde },
  loginTopo: { alignItems: 'center', paddingTop: 80, paddingBottom: 40 },
  loginLogoBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  loginLogoIcon: { fontSize: 32, color: C.dourado },
  loginNomeApp: { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  loginTagline: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  loginCard: {
    backgroundColor: '#fff', marginHorizontal: 24, borderRadius: 20,
    padding: 24, shadowColor: '#000', shadowOpacity: 0.12,
    shadowRadius: 16, elevation: 8,
  },
  loginCardTitulo: { fontSize: 20, fontWeight: '700', color: C.texto, marginBottom: 4 },
  loginCardSub: { fontSize: 13, color: C.cinza, marginBottom: 20 },
  loginBotao: {
    backgroundColor: C.verde, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  loginBotaoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  loginErro: { color: C.erro, fontSize: 13, marginTop: 8, textAlign: 'center' },
  loginRodape: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center', marginTop: 24 },

  // HEADER
  header: { backgroundColor: C.verde, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(201,168,76,0.25)', alignItems: 'center', justifyContent: 'center' },
  logoIcon: { fontSize: 18, color: C.dourado },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  progressoGeral: { marginTop: 4 },
  progressoLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  progressoMedia: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // NAVBAR
  navbar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E8E4DE',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8, paddingTop: 8,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navIcon: { fontSize: 20 },
  navIconAtivo: {},
  navLabel: { fontSize: 10, color: C.cinza },
  navLabelAtivo: { color: C.verde, fontWeight: '600' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.dourado, marginTop: 2 },

  // FAB
  fab: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 90 : 70,
    right: 20, width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.verde, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.verde, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 28, color: C.dourado, lineHeight: 32 },

  // SCROLL / SEÇÃO
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  secao: { fontSize: 11, fontWeight: '700', color: C.cinza, letterSpacing: 0.8, marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },

  // CARDS
  cardWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.begeCard, borderRadius: 14,
    padding: 14, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardNome: { fontSize: 14, fontWeight: '600', color: C.texto },
  cardPerfil: { fontSize: 12, color: C.cinza, marginTop: 2 },
  cardEmpreendimento: { fontSize: 11, color: C.textoSub, marginTop: 2 },
  pct: { fontSize: 13, fontWeight: '700', color: C.dourado, marginLeft: 8 },
  btnExcluirCard: { padding: 10, marginLeft: 6 },
  btnExcluirCardTexto: { fontSize: 16 },

  // AVATAR
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.verde, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: C.dourado, fontWeight: '700', fontSize: 14 },

  // FORMULÁRIO
  label: { fontSize: 12, fontWeight: '600', color: C.textoSub, marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: C.cinzaClaro, borderRadius: 10, padding: 12,
    fontSize: 14, color: C.texto, borderWidth: 1, borderColor: 'transparent',
  },
  opcoes: { flexDirection: 'row', gap: 8, marginTop: 4 },
  opcao: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.cinzaClaro, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: C.verde },
  opcaoTexto: { fontSize: 12, color: C.textoSub, fontWeight: '500' },
  opcaoTextoAtivo: { color: '#fff', fontWeight: '700' },
  faixaBox: { borderRadius: 8, padding: 10, marginTop: 8 },
  faixaBoxOk: { backgroundColor: C.verdeClaro },
  faixaBoxErro: { backgroundColor: C.erroClaro },
  faixaTexto: { fontSize: 12, fontWeight: '500' },
  faixaTextoOk: { color: C.verdeMedio },
  faixaTextoErro: { color: C.erro },

  // MODAL
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: C.texto, marginBottom: 4 },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancelar: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.cinzaClaro, alignItems: 'center' },
  btnCancelarTexto: { color: C.textoSub, fontWeight: '600' },
  btnSalvar: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.verde, alignItems: 'center' },
  btnSalvarTexto: { color: '#fff', fontWeight: '700' },

  // CHECKLIST
  btnVoltar: { marginBottom: 8 },
  btnVoltarTexto: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  checklistNome: { fontSize: 18, fontWeight: '700', color: '#fff' },
  checklistSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  progressoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressoBarFundo: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
  progressoBarFill: { height: 6, borderRadius: 3 },
  progressoPct: { fontSize: 14, fontWeight: '700', color: C.dourado, width: 36, textAlign: 'right' },
  progressoContador: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 },

  // DOC ITEM
  docCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#EDE9E3' },
  docCardEntregue: { borderColor: C.verdeClaro, backgroundColor: '#F7FBF9' },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  docNome: { fontSize: 13, fontWeight: '600', color: C.texto },
  docNomeEntregue: { color: C.verdeMedio, textDecorationLine: 'line-through' },
  docSub: { fontSize: 11, color: C.cinza, marginTop: 2 },
  checkbox: { padding: 2 },
  checkboxBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.cinza, alignItems: 'center', justifyContent: 'center' },
  checkboxBoxAtivo: { backgroundColor: C.verdeMedio, borderColor: C.verdeMedio },
  checkboxCheck: { color: '#fff', fontSize: 13, fontWeight: '700' },
  badgePendente: { backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgePendenteTexto: { fontSize: 10, color: '#E65100', fontWeight: '600' },
  expandIcon: { fontSize: 10, color: C.cinza, marginLeft: 4 },
  obsBox: { borderTopWidth: 1, borderTopColor: '#F0EDE8', padding: 14 },
  obsLabel: { fontSize: 11, fontWeight: '600', color: C.cinza, marginBottom: 6 },
  obsInput: { backgroundColor: C.cinzaClaro, borderRadius: 8, padding: 10, fontSize: 13, color: C.texto, minHeight: 60 },
  obsSalvar: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: C.verde, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  obsSalvarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // DASHBOARD
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum: { fontSize: 28, fontWeight: '700', color: C.verde },
  statLabel: { fontSize: 11, color: C.cinza, marginTop: 4, textAlign: 'center' },

  // CONFIGURAÇÕES
  configPerfilCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  configCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  configItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F5F0E8' },
  configItemIcon: { fontSize: 20 },
  configItemLabel: { fontSize: 14, fontWeight: '500', color: C.texto },
  configItemSub: { fontSize: 11, color: C.cinza, marginTop: 2 },
  configSeta: { fontSize: 20, color: C.cinza, marginLeft: 'auto' },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: C.verdeMedio },
  toggleOff: { backgroundColor: C.cinzaClaro },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  badgeCor: { backgroundColor: C.verdeClaro, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  badgeTexto: { fontSize: 11, color: C.verdeMedio, fontWeight: '600' },
  btnLogout: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: C.erroClaro, marginTop: 8 },
  btnLogoutTexto: { color: C.erro, fontWeight: '700', fontSize: 14 },
  btnWA: { backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnWATexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
});