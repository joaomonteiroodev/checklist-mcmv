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
import { useEffect, useRef, useState } from 'react';
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
  verdeMedio: '#1D9E75',
  verdeClaro: '#E8F5F0',
  cinza: '#888780',
  cinzaClaro: '#F0EDE8',
  cinzaBorda: '#E8E4DE',
  texto: '#1C1C1A',
  textoSub: '#6B6A66',
  erro: '#993C1D',
  erroClaro: '#FAECE7',
  wa: '#25D366',
  laranja: '#E65100',
  laranjaClaro: '#FFF3E0',
};

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type Perfil = 'CLT' | 'Autônomo' | 'Func. Público';
type Aba = 'clientes' | 'dashboard' | 'configuracoes';
type Role = 'corretor' | 'gestor';
type StatusCliente = 'Em atendimento' | 'Em análise' | 'Aguardando banco' | 'Aprovado' | 'Reprovado';

interface Documento {
  id: number;
  nome: string;
  sub: string;
  entregue: boolean;
  observacao: string;
  arquivoBase64?: string;
  arquivoNome?: string;
  arquivoTipo?: string;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  perfil: Perfil;
  renda: number;
  faixa: string;
  empreendimento: string;
  status: StatusCliente;
  docs: Documento[];
  corretorId: string;
  corretorEmail?: string;
  corretorNome?: string;
  gestorId?: string;
  ultimaAtualizacao?: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcularFaixa(renda: number): string {
  if (renda <= 3200) return '1';
  if (renda <= 5000) return '2';
  if (renda <= 9600) return '3';
  if (renda <= 13000) return '4';
  return 'Fora do MCMV';
}

function getLabelFaixa(faixa: string): string {
  if (faixa === 'Fora do MCMV') return 'Fora do MCMV';
  return `Faixa ${faixa}`;
}

function getDocsPorPerfil(perfil: Perfil): Omit<Documento, 'entregue' | 'observacao'>[] {
  if (perfil === 'CLT') {
    return [
      { id: 1, nome: 'RG e CPF', sub: 'Documento de identificação' },
      { id: 2, nome: 'Certidão de Casamento | Nascimento | Óbito', sub: 'Conforme estado civil' },
      { id: 3, nome: 'E-mail', sub: 'Endereço de e-mail ativo' },
      { id: 4, nome: 'Comprovante de renda', sub: 'Últimos 3 holerites' },
      { id: 5, nome: 'Comprovante de residência', sub: 'Últimos 3 meses' },
      { id: 6, nome: 'CTPS', sub: 'Carteira de trabalho' },
      { id: 7, nome: 'Extrato do FGTS', sub: 'Últimos 24 meses' },
      { id: 8, nome: 'Tela do FGTS', sub: 'Print ou cópia da tela' },
    ];
  }
  if (perfil === 'Autônomo') {
    return [
      { id: 1, nome: 'RG e CPF', sub: 'Documento de identificação' },
      { id: 2, nome: 'Certidão de Casamento | Nascimento | Óbito', sub: 'Conforme estado civil' },
      { id: 3, nome: 'E-mail', sub: 'Endereço de e-mail ativo' },
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
      { id: 1, nome: 'RG e CPF', sub: 'Documento de identificação' },
      { id: 2, nome: 'Certidão de Casamento | Nascimento | Óbito', sub: 'Conforme estado civil' },
      { id: 3, nome: 'E-mail', sub: 'Endereço de e-mail ativo' },
      { id: 4, nome: '03 últimos comprovantes de renda', sub: 'Contracheques' },
      { id: 5, nome: 'Contrato ou termo de posse', sub: 'Documento de vínculo com o órgão' },
      { id: 6, nome: 'CTPS', sub: 'Carteira de trabalho' },
      { id: 7, nome: 'Comprovante de residência', sub: 'Últimos 3 meses' },
      { id: 8, nome: 'Imposto de renda', sub: 'Se declarar' },
    ];
  }
  return [
    { id: 1, nome: 'RG e CPF', sub: 'Documento de identificação' },
    { id: 2, nome: 'Certidão de Casamento | Nascimento | Óbito', sub: 'Conforme estado civil' },
    { id: 3, nome: 'E-mail', sub: 'Endereço de e-mail ativo' },
    { id: 4, nome: 'Comprovante de residência', sub: 'Últimos 3 meses' },
    { id: 5, nome: 'CTPS', sub: 'Carteira de trabalho' },
    { id: 6, nome: 'Extrato do FGTS', sub: 'Últimos 24 meses' },
    { id: 7, nome: 'Tela do FGTS', sub: 'Print ou cópia da tela' },
  ];
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

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function diasSemAtualizar(ts?: number): number {
  if (!ts) return 0;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function formatarRenda(renda: number): string {
  return renda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

const STATUS_CORES: Record<StatusCliente, { bg: string; text: string }> = {
  'Em atendimento': { bg: '#EEF2FF', text: '#3730A3' },
  'Em análise':     { bg: '#FFF7ED', text: '#C2410C' },
  'Aguardando banco': { bg: '#FFFBEB', text: '#B45309' },
  'Aprovado':       { bg: C.verdeClaro, text: C.verdeMedio },
  'Reprovado':      { bg: C.erroClaro, text: C.erro },
};

// ─── EMAILJS ──────────────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID = 'service_5kcdmca';
const EMAILJS_TEMPLATE_ID = 'template_loetntf';
const EMAILJS_PUBLIC_KEY = 'UTaEmAAnR1rOz-qgQ';

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
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [modoCadastro, setModoCadastro] = useState(false);
  const [role, setRole] = useState<Role>('corretor');
  const [gestorCodigo, setGestorCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [senhaEnviada, setSenhaEnviada] = useState(false);

  async function recuperarSenha() {
    if (!email.trim()) { setErro('Digite seu e-mail para recuperar a senha.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSenhaEnviada(true); setErro('');
    } catch (e: any) { setErro(traduzirErroAuth(e.code || '')); }
  }

  async function entrar() {
    if (!email.trim() || !senha.trim()) { setErro('Preencha e-mail e senha.'); return; }
    if (modoCadastro && !nome.trim()) { setErro('Digite seu nome.'); return; }
    setErro(''); setCarregando(true);
    try {
      if (modoCadastro) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
        const gestorId = (role === 'corretor' && gestorCodigo.trim()) ? gestorCodigo.trim() : null;
        await addDoc(collection(db, 'usuarios'), {
          uid: cred.user.uid,
          email: email.trim(),
          nome: nome.trim(),
          sobrenome: sobrenome.trim(),
          nomeCompleto: `${nome.trim()} ${sobrenome.trim()}`.trim(),
          role,
          gestorId,
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), senha);
      }
    } catch (e: any) {
      setErro(traduzirErroAuth(e.code || ''));
    } finally { setCarregando(false); }
  }

  return (
    <ScrollView style={s.loginBg} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.loginTopo}>
        <View style={s.loginLogoBox}>
          <Text style={s.loginLogoCheck}>✓</Text>
        </View>
        <Text style={s.loginNome}>Certus</Text>
        <Text style={s.loginTagline}>Documentação MCMV simplificada</Text>
      </View>

      <View style={s.loginCard}>
        <Text style={s.loginCardTitulo}>{modoCadastro ? 'Criar conta' : 'Bem-vindo de volta'}</Text>
        <Text style={s.loginCardSub}>{modoCadastro ? 'Preencha os dados para começar' : 'Acesse para gerenciar seus clientes'}</Text>

        {modoCadastro && (
          <>
            <Text style={s.label}>Tipo de conta</Text>
            <View style={s.opcoes}>
              {(['corretor', 'gestor'] as Role[]).map(r => (
                <TouchableOpacity key={r} style={[s.opcao, role === r && s.opcaoAtiva]} onPress={() => setRole(r)}>
                  <Text style={[s.opcaoTexto, role === r && s.opcaoTextoAtivo]}>
                    {r === 'corretor' ? '👤 Corretor' : '🏢 Gestor'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Nome</Text>
            <TextInput style={s.input} placeholder="Ex.: João" value={nome} onChangeText={setNome} placeholderTextColor={C.cinza} />

            <Text style={s.label}>Sobrenome</Text>
            <TextInput style={s.input} placeholder="Ex.: Monteiro" value={sobrenome} onChangeText={setSobrenome} placeholderTextColor={C.cinza} />

            {role === 'corretor' && (
              <>
                <Text style={s.label}>Código do gestor (opcional)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Cole o UID do seu gestor aqui"
                  value={gestorCodigo}
                  onChangeText={setGestorCodigo}
                  autoCapitalize="none"
                  placeholderTextColor={C.cinza}
                />
                <Text style={{ fontSize: 11, color: C.cinza, marginTop: 4 }}>
                  Peça o código para o seu gestor nas Configurações do app.
                </Text>
              </>
            )}
          </>
        )}

        <Text style={s.label}>E-mail</Text>
        <TextInput style={s.input} placeholder="seu@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={C.cinza} />

        <Text style={s.label}>Senha</Text>
        <TextInput style={s.input} placeholder="••••••••" value={senha} onChangeText={setSenha} secureTextEntry placeholderTextColor={C.cinza} />

        {erro ? <Text style={s.loginErro}>{erro}</Text> : null}
        {senhaEnviada ? <Text style={{ color: C.verdeMedio, fontSize: 13, textAlign: 'center', marginTop: 8 }}>E-mail de recuperação enviado!</Text> : null}

        <TouchableOpacity style={[s.loginBotao, carregando && { opacity: 0.6 }]} onPress={entrar} disabled={carregando}>
          <Text style={s.loginBotaoTexto}>{carregando ? 'Aguarde...' : modoCadastro ? 'Criar conta' : 'Entrar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setModoCadastro(!modoCadastro); setErro(''); }} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: C.texto, fontSize: 14, fontWeight: '500' }}>{modoCadastro ? 'Já tenho conta — Entrar' : 'Não tenho conta'}</Text>
        </TouchableOpacity>

        {!modoCadastro && (
          <TouchableOpacity onPress={recuperarSenha} style={{ marginTop: 10, alignItems: 'center' }}>
            <Text style={{ color: C.cinza, fontSize: 13 }}>Esqueceu a senha?</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.loginRodape}>Certus © 2026</Text>
    </ScrollView>
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
  const [userRole, setUserRole] = useState<Role>('corretor');
  const [userGestorId, setUserGestorId] = useState<string | null>(null);
  const [userNomeCompleto, setUserNomeCompleto] = useState('');
  const [perfilIncompleto, setPerfilIncompleto] = useState(false);
  const [userDocId, setUserDocId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroFaixa, setFiltroFaixa] = useState<string>('Todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos');
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoEmailCliente, setNovoEmailCliente] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<Perfil>('CLT');
  const [novaRenda, setNovaRenda] = useState('');
  const [novoEmpreendimento, setNovoEmpreendimento] = useState('');
  const [modalExcluirCliente, setModalExcluirCliente] = useState<Cliente | null>(null);

  const faixaPreview = novaRenda ? calcularFaixa(parseFloat(novaRenda.replace(',', '.'))) : null;

  useEffect(() => {
    const q = query(collection(db, 'usuarios'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setUserDocId(docSnap.id);
        setUserRole(data.role || 'corretor');
        setUserGestorId(data.gestorId || null);
        const nome = data.nomeCompleto || data.nome || '';
        setUserNomeCompleto(nome);
        // Usuário antigo sem nome: pede para completar
        setPerfilIncompleto(!nome.trim());
      } else {
        // Usuário novo sem documento no Firestore (criado antes dessa versão)
        setPerfilIncompleto(true);
      }
    });
    return unsubscribe;
  }, [user.uid]);

  useEffect(() => {
    let q;
    if (userRole === 'gestor') {
      q = query(collection(db, 'clientes'), where('gestorId', '==', user.uid));
    } else {
      q = query(collection(db, 'clientes'), where('corretorId', '==', user.uid));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Cliente[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Cliente, 'id'>) }));
      setClientes(lista);
      setCarregando(false);
    }, () => setCarregando(false));
    return unsubscribe;
  }, [user.uid, userRole]);

  async function adicionarCliente() {
    if (!novoNome.trim() || !novaRenda.trim()) return;
    const renda = parseFloat(novaRenda.replace(',', '.'));
    if (isNaN(renda) || renda <= 0) return;
    try {
      await addDoc(collection(db, 'clientes'), {
        nome: novoNome.trim(),
        telefone: novoTelefone.trim(),
        email: novoEmailCliente.trim(),
        perfil: novoPerfil,
        renda,
        faixa: calcularFaixa(renda),
        empreendimento: novoEmpreendimento.trim(),
        status: 'Em atendimento' as StatusCliente,
        docs: inicializarDocs(novoPerfil),
        corretorId: user.uid,
        corretorEmail: user.email,
        corretorNome: userNomeCompleto || user.email,
        gestorId: userGestorId || null,
        ultimaAtualizacao: Date.now(),
      });
    } catch { alert('Erro ao salvar cliente.'); }
    setNovoNome(''); setNovoTelefone(''); setNovoEmailCliente('');
    setNovoPerfil('CLT'); setNovaRenda(''); setNovoEmpreendimento('');
    setModalAberto(false);
  }

  async function excluirCliente(cliente: Cliente) {
    try { await deleteDoc(doc(db, 'clientes', cliente.id)); } catch { alert('Erro ao excluir.'); }
    setModalExcluirCliente(null);
  }

  async function atualizarCliente(clienteAtualizado: Cliente) {
    const { id, ...dados } = clienteAtualizado;
    setClienteSelecionado(clienteAtualizado);
    try {
      await updateDoc(doc(db, 'clientes', id), { ...dados, ultimaAtualizacao: Date.now() });
    } catch { alert('Erro ao salvar.'); }
  }

  // Filtros
  const clientesFiltrados = clientes.filter(c => {
    const buscaOk = busca.trim() === '' ||
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (c.empreendimento || '').toLowerCase().includes(busca.toLowerCase());
    const faixaOk = filtroFaixa === 'Todas' || c.faixa === filtroFaixa;
    const statusOk = filtroStatus === 'Todos' || c.status === filtroStatus;
    return buscaOk && faixaOk && statusOk;
  });

  if (carregando) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.cinza }}>Carregando...</Text>
      </View>
    );
  }

  if (perfilIncompleto) {
    return <TelaCompletarPerfil user={user} userDocId={userDocId} onConcluido={() => setPerfilIncompleto(false)} />;
  }

  if (tela === 'checklist' && clienteSelecionado) {
    return (
      <ChecklistScreen
        cliente={clienteSelecionado}
        voltar={() => setTela('lista')}
        onAtualizar={atualizarCliente}
        onExcluir={(c) => { excluirCliente(c); setTela('lista'); }}
        userEmail={user.email}
      />
    );
  }

  const mediaPct = clientes.length > 0
    ? Math.round(clientes.reduce((acc, c) => {
        const e = c.docs.filter(d => d.entregue).length;
        return acc + (c.docs.length > 0 ? e / c.docs.length : 0);
      }, 0) / clientes.length * 100)
    : 0;

  return (
    <View style={s.container}>
      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerLogo}>
          <View style={s.logoBox}><Text style={s.logoCheck}>✓</Text></View>
          <Text style={s.headerNome}>Certus</Text>
          {userRole === 'gestor' && (
            <View style={{ backgroundColor: C.dourado, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6 }}>
              <Text style={{ color: C.verde, fontSize: 10, fontWeight: '700' }}>GESTOR</Text>
            </View>
          )}
        </View>
        <Text style={s.headerSub}>
          {abaAtiva === 'clientes' ? 'Documentação MCMV' : abaAtiva === 'dashboard' ? 'Dashboard' : 'Configurações'}
        </Text>
        {abaAtiva === 'clientes' && (
          <View style={s.headerStats}>
            <View style={s.headerStatItem}>
              <Text style={s.headerStatNum}>{clientes.length}</Text>
              <Text style={s.headerStatLabel}>{userRole === 'gestor' ? 'Clientes da equipe' : 'Clientes ativos'}</Text>
            </View>
            <View style={s.headerDivider} />
            <View style={s.headerStatItem}>
              <Text style={[s.headerStatNum, { color: C.dourado }]}>{mediaPct}%</Text>
              <Text style={s.headerStatLabel}>Média geral</Text>
            </View>
          </View>
        )}
      </View>

      {/* CONTEÚDO */}
      <View style={{ flex: 1 }}>
        {abaAtiva === 'clientes' && (
          <TelaClientes
            clientes={clientesFiltrados}
            todosClientes={clientes}
            userRole={userRole}
            busca={busca}
            setBusca={setBusca}
            filtroFaixa={filtroFaixa}
            setFiltroFaixa={setFiltroFaixa}
            filtroStatus={filtroStatus}
            setFiltroStatus={setFiltroStatus}
            onAbrirCliente={(c) => { setClienteSelecionado(c); setTela('checklist'); }}
            onExcluirCliente={setModalExcluirCliente}
          />
        )}
        {abaAtiva === 'dashboard' && <TelaDashboard clientes={clientes} />}
        {abaAtiva === 'configuracoes' && <TelaConfiguracoes user={user} userRole={userRole} userNome={userNomeCompleto} userDocId={userDocId} userGestorId={userGestorId} clientes={clientes} />}
      </View>

      {/* FAB */}
      {abaAtiva === 'clientes' && userRole === 'corretor' && (
        <TouchableOpacity style={s.fab} onPress={() => setModalAberto(true)}>
          <Text style={s.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* NAVBAR */}
      <View style={s.navbar}>
        {([
          { key: 'clientes', label: 'Clientes', icone: '👤' },
          { key: 'dashboard', label: 'Dashboard', icone: '📊' },
          { key: 'configuracoes', label: 'Config', icone: '⚙️' },
        ] as { key: Aba; label: string; icone: string }[]).map(item => (
          <TouchableOpacity key={item.key} style={s.navItem} onPress={() => setAbaAtiva(item.key)}>
            <Text style={[s.navIcone, abaAtiva === item.key && { color: C.verde }]}>{item.icone}</Text>
            <Text style={[s.navLabel, abaAtiva === item.key && s.navLabelAtivo]}>{item.label}</Text>
            <View style={[s.navDot, { backgroundColor: abaAtiva === item.key ? C.dourado : 'transparent' }]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal Novo Cliente */}
      <Modal visible={modalAberto} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <ScrollView>
            <View style={[s.modalBox, { marginTop: 60 }]}>
              <View style={s.modalAlca} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={s.modalTitulo}>Novo Cliente</Text>
                <TouchableOpacity onPress={() => setModalAberto(false)} style={s.modalFechar}>
                  <Text style={{ color: C.cinza, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.label}>Nome completo</Text>
              <TextInput style={s.input} placeholder="Ex.: Ana Paula Ribeiro" value={novoNome} onChangeText={setNovoNome} placeholderTextColor={C.cinza} />
              <Text style={s.label}>Telefone (WhatsApp)</Text>
              <TextInput style={s.input} placeholder="(81) 99999-9999" value={novoTelefone} onChangeText={setNovoTelefone} keyboardType="phone-pad" placeholderTextColor={C.cinza} />
              <Text style={s.label}>E-mail do cliente</Text>
              <TextInput style={s.input} placeholder="cliente@email.com" value={novoEmailCliente} onChangeText={setNovoEmailCliente} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.cinza} />
              <Text style={s.label}>Empreendimento</Text>
              <TextInput style={s.input} placeholder="Ex.: Mirante Belvedere" value={novoEmpreendimento} onChangeText={setNovoEmpreendimento} placeholderTextColor={C.cinza} />
              <Text style={s.label}>Perfil profissional</Text>
              <View style={s.opcoes}>
                {(['CLT', 'Autônomo', 'Func. Público'] as Perfil[]).map(p => (
                  <TouchableOpacity key={p} style={[s.opcao, novoPerfil === p && s.opcaoAtiva]} onPress={() => setNovoPerfil(p)}>
                    <Text style={[s.opcaoTexto, novoPerfil === p && s.opcaoTextoAtivo]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Renda familiar (R$)</Text>
              <TextInput style={s.input} placeholder="Ex.: 3200" value={novaRenda} onChangeText={setNovaRenda} keyboardType="numeric" placeholderTextColor={C.cinza} />
              {faixaPreview && (
                <View style={[s.faixaBox, faixaPreview === 'Fora do MCMV' ? s.faixaBoxErro : s.faixaBoxOk]}>
                  <Text style={[s.faixaTexto, faixaPreview === 'Fora do MCMV' ? { color: C.erro } : { color: C.verdeMedio }]}>
                    {faixaPreview === 'Fora do MCMV' ? 'Renda acima do limite do MCMV' : `Faixa ${faixaPreview} — cliente elegível ao MCMV`}
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
          </ScrollView>
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

// ─── COMPLETAR PERFIL ─────────────────────────────────────────────────────────
function TelaCompletarPerfil({ user, userDocId, onConcluido }: {
  user: User;
  userDocId: string | null;
  onConcluido: () => void;
}) {
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [role, setRole] = useState<Role>('corretor');
  const [gestorCodigo, setGestorCodigo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!nome.trim()) { setErro('Digite seu nome.'); return; }
    setSalvando(true);
    setErro('');
    const nomeCompleto = `${nome.trim()} ${sobrenome.trim()}`.trim();
    const gestorId = (role === 'corretor' && gestorCodigo.trim()) ? gestorCodigo.trim() : null;
    try {
      if (userDocId) {
        await updateDoc(doc(db, 'usuarios', userDocId), { nome: nome.trim(), sobrenome: sobrenome.trim(), nomeCompleto, role, gestorId });
      } else {
        await addDoc(collection(db, 'usuarios'), { uid: user.uid, email: user.email, nome: nome.trim(), sobrenome: sobrenome.trim(), nomeCompleto, role, gestorId });
      }
      onConcluido();
    } catch { setErro('Erro ao salvar. Tente novamente.'); }
    finally { setSalvando(false); }
  }

  return (
    <ScrollView style={[s.loginBg, { flex: 1 }]} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={s.loginTopo}>
        <View style={s.loginLogoBox}>
          <Text style={s.loginLogoCheck}>✓</Text>
        </View>
        <Text style={s.loginNome}>Certus</Text>
        <Text style={s.loginTagline}>Complete seu cadastro para continuar</Text>
      </View>

      <View style={s.loginCard}>
        <Text style={s.loginCardTitulo}>Completar perfil</Text>
        <Text style={s.loginCardSub}>Precisamos de algumas informações básicas</Text>

        <Text style={s.label}>Tipo de conta</Text>
        <View style={s.opcoes}>
          {(['corretor', 'gestor'] as Role[]).map(r => (
            <TouchableOpacity key={r} style={[s.opcao, role === r && s.opcaoAtiva]} onPress={() => setRole(r)}>
              <Text style={[s.opcaoTexto, role === r && s.opcaoTextoAtivo]}>
                {r === 'corretor' ? '👤 Corretor' : '🏢 Gestor'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Nome</Text>
        <TextInput style={s.input} placeholder="Ex.: João" value={nome} onChangeText={setNome} placeholderTextColor={C.cinza} />

        <Text style={s.label}>Sobrenome</Text>
        <TextInput style={s.input} placeholder="Ex.: Monteiro" value={sobrenome} onChangeText={setSobrenome} placeholderTextColor={C.cinza} />

        {role === 'corretor' && (
          <>
            <Text style={s.label}>Código do gestor (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="Cole o UID do seu gestor aqui"
              value={gestorCodigo}
              onChangeText={setGestorCodigo}
              autoCapitalize="none"
              placeholderTextColor={C.cinza}
            />
            <Text style={{ fontSize: 11, color: C.cinza, marginTop: 4 }}>
              Peça o código para o seu gestor nas Configurações do app.
            </Text>
          </>
        )}

        {erro ? <Text style={s.loginErro}>{erro}</Text> : null}

        <TouchableOpacity style={[s.loginBotao, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
          <Text style={s.loginBotaoTexto}>{salvando ? 'Salvando...' : 'Concluir cadastro'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => signOut(auth)} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: C.cinza, fontSize: 13 }}>Sair e entrar com outra conta</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.loginRodape}>Certus © 2026</Text>
    </ScrollView>
  );
}

// ─── ABA CLIENTES ─────────────────────────────────────────────────────────────
function TelaClientes({
  clientes, todosClientes, userRole, busca, setBusca,
  filtroFaixa, setFiltroFaixa, filtroStatus, setFiltroStatus,
  onAbrirCliente, onExcluirCliente,
}: {
  clientes: Cliente[];
  todosClientes: Cliente[];
  userRole: Role;
  busca: string;
  setBusca: (v: string) => void;
  filtroFaixa: string;
  setFiltroFaixa: (v: string) => void;
  filtroStatus: string;
  setFiltroStatus: (v: string) => void;
  onAbrirCliente: (c: Cliente) => void;
  onExcluirCliente: (c: Cliente) => void;
}) {
  const faixas = ['Todas', '1', '2', '3', '4', 'Fora do MCMV'];
  const statusList: string[] = ['Todos', 'Em atendimento', 'Em análise', 'Aguardando banco', 'Aprovado', 'Reprovado'];

  return (
    <View style={{ flex: 1 }}>
      {/* Barra de busca */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
        <TextInput
          style={s.inputBusca}
          placeholder="🔍  Buscar por nome ou empreendimento..."
          value={busca}
          onChangeText={setBusca}
          placeholderTextColor={C.cinza}
        />

        {/* Filtro faixa */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 2 }}>
          {faixas.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.chipFiltro, filtroFaixa === f && s.chipFiltroAtivo]}
              onPress={() => setFiltroFaixa(f)}
            >
              <Text style={[s.chipFiltroTexto, filtroFaixa === f && s.chipFiltroTextoAtivo]}>
                {f === 'Todas' ? 'Todas as faixas' : f === 'Fora do MCMV' ? 'Fora' : `Faixa ${f}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtro status */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statusList.map(st => (
            <TouchableOpacity
              key={st}
              style={[s.chipFiltro, filtroStatus === st && s.chipFiltroAtivo]}
              onPress={() => setFiltroStatus(st)}
            >
              <Text style={[s.chipFiltroTexto, filtroStatus === st && s.chipFiltroTextoAtivo]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {clientes.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📋</Text>
            <Text style={{ color: C.cinza, fontSize: 14, textAlign: 'center' }}>
              {todosClientes.length === 0
                ? userRole === 'gestor'
                  ? 'Nenhum cliente da equipe ainda.\nCorretores precisam informar seu código ao criar conta.'
                  : 'Nenhum cliente ainda.\nToque no + para adicionar.'
                : 'Nenhum cliente encontrado para este filtro.'}
            </Text>
          </View>
        )}
        {clientes.map(c => {
          const entregues = c.docs.filter(d => d.entregue).length;
          const total = c.docs.length;
          const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;
          const pendentes = total - entregues;
          const fora = c.faixa === 'Fora do MCMV';
          const dias = diasSemAtualizar(c.ultimaAtualizacao);
          const parado = dias >= 3 && pct < 100;
          const corStatus = STATUS_CORES[c.status] || STATUS_CORES['Em atendimento'];

          return (
            <View key={c.id} style={s.cardWrapper}>
              <TouchableOpacity style={[s.card, parado && { borderWidth: 1, borderColor: C.laranja }]} onPress={() => onAbrirCliente(c)} activeOpacity={0.7}>
                <View style={s.avatar}>
                  <Text style={s.avatarTexto}>{getIniciais(c.nome)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={s.cardNome}>{c.nome}</Text>
                    {parado && (
                      <View style={s.badgeParado}>
                        <Text style={s.badgeParadoTexto}>Parado {dias}d</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.cardSub}>{c.perfil} · {getLabelFaixa(c.faixa)} · {pendentes} pendentes</Text>
                  {c.empreendimento ? <Text style={s.cardEmpre}>{c.empreendimento}</Text> : null}
                  {userRole === 'gestor' && c.corretorNome ? (
                    <Text style={[s.cardEmpre, { color: C.dourado, fontWeight: '500' }]}>👤 {c.corretorNome}</Text>
                  ) : null}
                  {c.status && (
                    <View style={[s.statusBadge, { backgroundColor: corStatus.bg, marginTop: 4 }]}>
                      <Text style={[s.statusTexto, { color: corStatus.text }]}>{c.status}</Text>
                    </View>
                  )}
                  <View style={s.miniBarFundo}>
                    <View style={[s.miniBarFill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? C.verdeMedio : C.dourado }]} />
                  </View>
                </View>
                <Text style={[s.cardPct, pct === 100 && { color: C.verdeMedio }, fora && { color: C.erro }]}>
                  {fora ? '—' : `${pct}%`}
                </Text>
              </TouchableOpacity>
              {userRole === 'corretor' && (
                <TouchableOpacity style={s.btnLixeira} onPress={() => onExcluirCliente(c)}>
                  <Text style={{ fontSize: 15, color: C.cinza }}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
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

  const metricas = [
    { num: total, label: 'Total de clientes', cor: C.verde },
    { num: `${mediaPct}%`, label: 'Média geral', cor: C.dourado },
    { num: prontos, label: 'Prontos p/ envio', cor: C.verdeMedio },
    { num: pendentes, label: 'Com pendências', cor: C.erro },
  ];

  const faixas = ['1', '2', '3', '4', 'Fora do MCMV'].map(f => ({
    label: f === 'Fora do MCMV' ? 'Fora' : `Faixa ${f}`,
    count: clientes.filter(c => c.faixa === f).length,
  }));
  const maxCount = Math.max(1, ...faixas.map(f => f.count));

  const ranking = [...clientes]
    .map(c => {
      const e = c.docs.filter(d => d.entregue).length;
      return { ...c, pct: c.docs.length > 0 ? Math.round(e / c.docs.length * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  const statusDist = (['Em atendimento', 'Em análise', 'Aguardando banco', 'Aprovado', 'Reprovado'] as StatusCliente[]).map(st => ({
    label: st,
    count: clientes.filter(c => c.status === st).length,
    cor: STATUS_CORES[st],
  }));

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {metricas.map((m, i) => (
          <View key={i} style={s.statCard}>
            <Text style={[s.statNum, { color: m.cor }]}>{m.num}</Text>
            <Text style={s.statLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.secaoCard}>
        <Text style={s.secaoTitulo}>Distribuição por faixa</Text>
        {faixas.map(f => (
          <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: C.textoSub, width: 50 }}>{f.label}</Text>
            <View style={{ flex: 1, height: 8, backgroundColor: C.cinzaClaro, borderRadius: 4 }}>
              <View style={{ height: 8, backgroundColor: C.verde, borderRadius: 4, width: `${(f.count / maxCount) * 100}%` as any }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.texto, width: 20, textAlign: 'right' }}>{f.count}</Text>
          </View>
        ))}
      </View>

      <View style={[s.secaoCard, { marginTop: 12 }]}>
        <Text style={s.secaoTitulo}>Status dos clientes</Text>
        {statusDist.map(st => (
          <View key={st.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <View style={[s.statusBadge, { backgroundColor: st.cor.bg }]}>
              <Text style={[s.statusTexto, { color: st.cor.text }]}>{st.label}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.texto, marginLeft: 'auto' }}>{st.count}</Text>
          </View>
        ))}
      </View>

      <View style={[s.secaoCard, { marginTop: 12 }]}>
        <Text style={s.secaoTitulo}>Mais avançados</Text>
        {ranking.length === 0 && <Text style={{ color: C.cinza, fontSize: 13, marginTop: 8 }}>Nenhum cliente cadastrado.</Text>}
        {ranking.map((c, i) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.dourado, width: 24, textAlign: 'center' }}>{i + 1}</Text>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{getIniciais(c.nome)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 4 }}>
              <Text style={s.cardNome}>{c.nome}</Text>
              <Text style={s.cardSub}>{c.empreendimento || c.perfil}</Text>
            </View>
            <Text style={[s.cardPct, c.pct === 100 && { color: C.verdeMedio }]}>{c.pct}%</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── ABA CONFIGURAÇÕES ────────────────────────────────────────────────────────
function TelaConfiguracoes({ user, userRole, userNome, userDocId, userGestorId, clientes }: {
  user: User;
  userRole: Role;
  userNome: string;
  userDocId: string | null;
  userGestorId: string | null;
  clientes: Cliente[];
}) {
  const [novaSenha, setNovaSenha] = useState('');
  const [modalSenha, setModalSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState(false);

  // Notificações
  const [notifAtiva, setNotifAtiva] = useState(false);
  const [notifPermissao, setNotifPermissao] = useState<string>('default');
  const [copiado, setCopiado] = useState(false);

  // Vincular gestor (para corretor)
  const [modalGestor, setModalGestor] = useState(false);
  const [novoGestorCodigo, setNovoGestorCodigo] = useState(userGestorId || '');
  const [salvandoGestor, setSalvandoGestor] = useState(false);
  const [erroGestor, setErroGestor] = useState('');
  const [sucessoGestor, setSucessoGestor] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && 'Notification' in window) {
      setNotifPermissao((window as any).Notification.permission);
      // Se já tem permissão, considera ativo
      if ((window as any).Notification.permission === 'granted') setNotifAtiva(true);
    }
  }, []);

  // Dispara notificações de clientes pendentes a cada 4 horas (enquanto o app está aberto)
  useEffect(() => {
    if (!notifAtiva || Platform.OS !== 'web') return;
    function dispararLembretes() {
      const comPendencias = clientes.filter(c => c.docs.some(d => !d.entregue) && c.status !== 'Aprovado' && c.status !== 'Reprovado');
      comPendencias.forEach(c => {
        const pendentes = c.docs.filter(d => !d.entregue).length;
        try {
          new (window as any).Notification(`📋 ${c.nome}`, {
            body: `${pendentes} documento${pendentes > 1 ? 's' : ''} pendente${pendentes > 1 ? 's' : ''} — ${c.empreendimento || c.perfil}`,
            icon: '/favicon.ico',
          });
        } catch { /* silencioso */ }
      });
    }
    // Dispara na hora que ativar + a cada 2 dias
    dispararLembretes();
    const intervalo = setInterval(dispararLembretes, 2 * 24 * 60 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [notifAtiva, clientes]);

  async function toggleNotificacoes() {
    if (Platform.OS !== 'web' || !('Notification' in window)) {
      alert('Notificações não disponíveis neste dispositivo.');
      return;
    }
    if (notifAtiva) {
      setNotifAtiva(false);
      return;
    }
    const perm = await (window as any).Notification.requestPermission();
    setNotifPermissao(perm);
    if (perm === 'granted') {
      setNotifAtiva(true);
      new (window as any).Notification('✅ Certus', { body: 'Lembretes de documentação ativados!' });
    } else {
      alert('Permissão negada. Habilite notificações nas configurações do navegador.');
    }
  }

  async function alterarSenha() {
    if (novaSenha.length < 6) { setErroSenha('Mínimo 6 caracteres.'); return; }
    try {
      await updatePassword(user, novaSenha);
      setSucessoSenha(true); setNovaSenha('');
      setTimeout(() => { setModalSenha(false); setSucessoSenha(false); }, 1500);
    } catch { setErroSenha('Erro ao alterar. Faça login novamente.'); }
  }

  async function salvarGestor() {
    setSalvandoGestor(true); setErroGestor(''); setSucessoGestor(false);
    try {
      const gestorId = novoGestorCodigo.trim() || null;
      if (userDocId) {
        await updateDoc(doc(db, 'usuarios', userDocId), { gestorId });
      }
      setSucessoGestor(true);
      setTimeout(() => { setModalGestor(false); setSucessoGestor(false); }, 1500);
    } catch { setErroGestor('Erro ao salvar. Tente novamente.'); }
    finally { setSalvandoGestor(false); }
  }

  function copiarCodigo() {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(user.uid).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      });
    }
  }

  const iniciais = userNome ? getIniciais(userNome) : (user.email?.slice(0, 2).toUpperCase() || 'JM');
  const pendentesTotal = clientes.filter(c => c.docs.some(d => !d.entregue)).length;

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.configPerfil}>
        <View style={[s.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
          <Text style={[s.avatarTexto, { fontSize: 18 }]}>{iniciais}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {userNome ? <Text style={{ fontSize: 15, fontWeight: '700', color: C.texto }}>{userNome}</Text> : null}
          <Text style={{ fontSize: 13, color: C.cinza }}>{user.email}</Text>
          <View style={s.badgeAtivo}>
            <Text style={s.badgeAtivoTexto}>{userRole === 'gestor' ? 'Gestor' : 'Corretor ativo'}</Text>
          </View>
        </View>
      </View>

      <Text style={s.secaoLabel}>CONTA</Text>
      <View style={s.secaoCard}>
        <TouchableOpacity style={s.configRow} onPress={() => setModalSenha(true)}>
          <Text style={s.configRowIcon}>🔒</Text>
          <Text style={s.configRowLabel}>Alterar senha</Text>
          <Text style={s.configRowSeta}>›</Text>
        </TouchableOpacity>
      </View>

      {/* EQUIPE — aparece para AMBOS os roles */}
      <Text style={s.secaoLabel}>EQUIPE</Text>
      <View style={s.secaoCard}>
        {userRole === 'gestor' ? (
          /* Gestor: mostra seu código com botão copiar */
          <View style={s.configRow}>
            <Text style={s.configRowIcon}>🔑</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.configRowLabel}>Seu código de gestor</Text>
              <Text style={{ fontSize: 11, color: C.cinza, marginTop: 2 }}>
                Compartilhe com seus corretores ao criar a conta deles
              </Text>
              <Text
                style={{ fontSize: 11, color: C.dourado, fontWeight: '700', marginTop: 6, fontFamily: 'monospace' }}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {user.uid}
              </Text>
            </View>
            <TouchableOpacity
              onPress={copiarCodigo}
              style={{ backgroundColor: copiado ? C.verdeClaro : C.cinzaClaro, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8 }}
            >
              <Text style={{ fontSize: 12, color: copiado ? C.verdeMedio : C.textoSub, fontWeight: '600' }}>
                {copiado ? '✓ Copiado' : '📋 Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Corretor: botão para vincular/alterar gestor */
          <TouchableOpacity style={s.configRow} onPress={() => { setNovoGestorCodigo(userGestorId || ''); setModalGestor(true); }}>
            <Text style={s.configRowIcon}>🏢</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.configRowLabel}>Vincular ao gestor</Text>
              <Text style={{ fontSize: 11, color: C.cinza, marginTop: 2 }}>
                {userGestorId ? '✓ Gestor vinculado' : 'Nenhum gestor vinculado ainda'}
              </Text>
            </View>
            <Text style={s.configRowSeta}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.secaoLabel}>NOTIFICAÇÕES</Text>
      <View style={s.secaoCard}>
        <View style={s.configRow}>
          <Text style={s.configRowIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.configRowLabel}>Lembretes de documentação</Text>
            <Text style={{ fontSize: 11, color: C.cinza, marginTop: 2 }}>
              {notifAtiva
                ? `Ativo · ${pendentesTotal} cliente${pendentesTotal !== 1 ? 's' : ''} com pendências · lembrete a cada 2 dias`
                : notifPermissao === 'denied'
                  ? 'Bloqueado — habilite nas configurações do navegador'
                  : 'Lembrete a cada 2 dias sobre docs pendentes dos seus clientes'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.toggle, notifAtiva ? s.toggleOn : s.toggleOff]}
            onPress={toggleNotificacoes}
          >
            <View style={[s.toggleDot, { left: notifAtiva ? 22 : 2 }]} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.secaoLabel}>IMOBILIÁRIA</Text>
      <View style={s.secaoCard}>
        <TouchableOpacity style={s.configRow}>
          <Text style={s.configRowIcon}>🏢</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.configRowLabel}>Logo da imobiliária</Text>
            <Text style={{ fontSize: 11, color: C.cinza }}>Em breve</Text>
          </View>
          <Text style={s.configRowSeta}>›</Text>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: C.cinzaBorda }} />
        <TouchableOpacity style={s.configRow}>
          <Text style={s.configRowIcon}>🎨</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.configRowLabel}>Cor da marca</Text>
            <Text style={{ fontSize: 11, color: C.cinza }}>Verde Certus (padrão)</Text>
          </View>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.dourado }} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.btnLogout} onPress={() => signOut(auth)}>
        <Text style={s.btnLogoutTexto}>Sair da conta</Text>
      </TouchableOpacity>

      {/* Modal Alterar Senha */}
      <Modal visible={modalSenha} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>Alterar senha</Text>
            <Text style={s.label}>Nova senha</Text>
            <TextInput style={s.input} placeholder="Mínimo 6 caracteres" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry placeholderTextColor={C.cinza} />
            {erroSenha ? <Text style={{ color: C.erro, fontSize: 13, marginTop: 8 }}>{erroSenha}</Text> : null}
            {sucessoSenha ? <Text style={{ color: C.verdeMedio, fontSize: 13, marginTop: 8 }}>Senha alterada!</Text> : null}
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

      {/* Modal Vincular Gestor (corretor) */}
      <Modal visible={modalGestor} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <View style={s.modalAlca} />
            <Text style={s.modalTitulo}>Vincular ao gestor</Text>
            <Text style={{ color: C.textoSub, fontSize: 13, marginTop: 6 }}>
              Cole o código que o seu gestor compartilhou. Deixe em branco para desvincular.
            </Text>
            <Text style={s.label}>Código do gestor</Text>
            <TextInput
              style={s.input}
              placeholder="Cole o UID aqui"
              value={novoGestorCodigo}
              onChangeText={setNovoGestorCodigo}
              autoCapitalize="none"
              placeholderTextColor={C.cinza}
            />
            {erroGestor ? <Text style={{ color: C.erro, fontSize: 13, marginTop: 8 }}>{erroGestor}</Text> : null}
            {sucessoGestor ? <Text style={{ color: C.verdeMedio, fontSize: 13, marginTop: 8 }}>✓ Gestor vinculado!</Text> : null}
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => { setModalGestor(false); setErroGestor(''); }}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnSalvar, salvandoGestor && { opacity: 0.6 }]} onPress={salvarGestor} disabled={salvandoGestor}>
                <Text style={s.btnSalvarTexto}>{salvandoGestor ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── CHECKLIST ────────────────────────────────────────────────────────────────
function ChecklistScreen({ cliente, voltar, onAtualizar, onExcluir, userEmail }: {
  cliente: Cliente;
  voltar: () => void;
  onAtualizar: (c: Cliente) => void;
  onExcluir: (c: Cliente) => void;
  userEmail: string | null;
}) {
  const [emailModal, setEmailModal] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [perfilModal, setPerfilModal] = useState(false);

  const entregues = cliente.docs.filter(d => d.entregue).length;
  const total = cliente.docs.length;
  const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;
  const waLink = `https://wa.me/${formatarTelefoneWA(cliente.telefone)}`;
  const corStatus = STATUS_CORES[cliente.status] || STATUS_CORES['Em atendimento'];

  async function enviarEmail() {
    if (!emailDestino.trim()) { alert('Digite o e-mail de destino.'); return; }
    setEnviandoEmail(true);
    const pendentesLista = cliente.docs.filter(d => !d.entregue).map(d => `• ${d.nome}`).join('\n');
    const entreguesLista = cliente.docs.filter(d => d.entregue).map(d => `✓ ${d.nome}`).join('\n');
    const corpo = `DOCUMENTOS ENTREGUES:\n${entreguesLista || 'Nenhum'}\n\nDOCUMENTOS PENDENTES:\n${pendentesLista || 'Nenhum'}`;
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: emailDestino,
            from_email: userEmail || 'certus@imobiliaria.com',
            from_name: userEmail?.split('@')[0] || 'Corretor Certus',
            cliente_nome: cliente.nome,
            empreendimento: cliente.empreendimento || 'Não informado',
            corpo,
          },
        }),
      });
      if (res.ok) { alert('E-mail enviado com sucesso!'); setEmailModal(false); setEmailDestino(''); }
      else { alert('Erro ao enviar. Verifique as configurações do EmailJS.'); }
    } catch { alert('Erro de conexão ao tentar enviar o e-mail.'); }
    finally { setEnviandoEmail(false); }
  }

  function toggleDoc(id: number) {
    const novosDocs = cliente.docs.map(d => d.id === id ? { ...d, entregue: !d.entregue } : d);
    onAtualizar({ ...cliente, docs: novosDocs });
  }

  function salvarObs(id: number, obs: string) {
    const novosDocs = cliente.docs.map(d => d.id === id ? { ...d, observacao: obs } : d);
    onAtualizar({ ...cliente, docs: novosDocs });
  }

  function salvarAnexo(id: number, base64: string, nome: string, tipo: string) {
    const novosDocs = cliente.docs.map(d => d.id === id ? { ...d, arquivoBase64: base64, arquivoNome: nome, arquivoTipo: tipo } : d);
    onAtualizar({ ...cliente, docs: novosDocs });
  }

  function removerAnexo(id: number) {
    const novosDocs = cliente.docs.map(d => d.id === id ? { ...d, arquivoBase64: undefined, arquivoNome: undefined, arquivoTipo: undefined } : d);
    onAtualizar({ ...cliente, docs: novosDocs });
  }

  function alterarStatus(novoStatus: StatusCliente) {
    onAtualizar({ ...cliente, status: novoStatus });
    setStatusModal(false);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={voltar} style={{ marginBottom: 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>‹ Voltar</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' }}>{cliente.nome}</Text>
          <TouchableOpacity onPress={() => setPerfilModal(true)}>
            <Text style={{ fontSize: 18 }}>ℹ️</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 2 }}>
          {cliente.perfil} · {getLabelFaixa(cliente.faixa)}{cliente.empreendimento ? ` · ${cliente.empreendimento}` : ''}
        </Text>

        {/* Status badge clicável */}
        <TouchableOpacity onPress={() => setStatusModal(true)} style={{ alignItems: 'center', marginTop: 8 }}>
          <View style={[s.statusBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={{ color: C.dourado, fontSize: 12, fontWeight: '600' }}>{cliente.status || 'Em atendimento'} ▾</Text>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: pct === 100 ? C.verdeMedio : C.dourado, width: `${pct}%` as any }} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.dourado }}>{pct}%</Text>
        </View>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 4 }}>
          {entregues} de {total} documentos entregues
        </Text>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} contentContainerStyle={{ paddingBottom: 120 }}>
        {cliente.docs.map(doc => (
          <DocItem
            key={doc.id}
            doc={doc}
            onToggle={toggleDoc}
            onSalvarObs={salvarObs}
            onSalvarAnexo={salvarAnexo}
            onRemoverAnexo={removerAnexo}
          />
        ))}

        <View style={{ marginTop: 16, gap: 10 }}>
          {cliente.telefone ? (
            <TouchableOpacity style={s.btnWA} onPress={() => Linking.openURL(waLink)}>
              <Text style={s.btnWATexto}>📱 Abrir WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.btnEmail} onPress={() => setEmailModal(true)}>
            <Text style={s.btnEmailTexto}>✉️ Enviar por E-mail</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnExcluir} onPress={() => onExcluir(cliente)}>
            <Text style={s.btnExcluirTexto}>🗑 Excluir cliente</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal E-mail */}
      <Modal visible={emailModal} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>Enviar checklist</Text>
            {userEmail && (
              <Text style={{ fontSize: 12, color: C.cinza, marginTop: 4, marginBottom: 8 }}>
                Enviando como: <Text style={{ color: C.verde, fontWeight: '600' }}>{userEmail}</Text>
              </Text>
            )}
            <Text style={s.label}>E-mail de destino</Text>
            <TextInput style={s.input} placeholder="cliente@exemplo.com" value={emailDestino} onChangeText={setEmailDestino} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.cinza} />
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => setEmailModal(false)}>
                <Text style={s.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnSalvar, enviandoEmail && { opacity: 0.6 }]} onPress={enviarEmail} disabled={enviandoEmail}>
                <Text style={s.btnSalvarTexto}>{enviandoEmail ? 'Enviando...' : 'Enviar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Status */}
      <Modal visible={statusModal} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>Alterar status</Text>
            <View style={{ gap: 8, marginTop: 16 }}>
              {(['Em atendimento', 'Em análise', 'Aguardando banco', 'Aprovado', 'Reprovado'] as StatusCliente[]).map(st => (
                <TouchableOpacity
                  key={st}
                  style={[s.statusOpcao, cliente.status === st && { borderColor: C.verde, borderWidth: 2 }]}
                  onPress={() => alterarStatus(st)}
                >
                  <View style={[s.statusBadge, { backgroundColor: STATUS_CORES[st].bg }]}>
                    <Text style={[s.statusTexto, { color: STATUS_CORES[st].text }]}>{st}</Text>
                  </View>
                  {cliente.status === st && <Text style={{ color: C.verde, fontSize: 14 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[s.btnCancelar, { marginTop: 16 }]} onPress={() => setStatusModal(false)}>
              <Text style={s.btnCancelarTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Perfil do Cliente */}
      <Modal visible={perfilModal} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <View style={s.modalAlca} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={s.modalTitulo}>Dados do Cliente</Text>
              <TouchableOpacity onPress={() => setPerfilModal(false)} style={s.modalFechar}>
                <Text style={{ color: C.cinza, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={[s.avatar, { width: 64, height: 64, borderRadius: 32 }]}>
                <Text style={[s.avatarTexto, { fontSize: 22 }]}>{getIniciais(cliente.nome)}</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.texto, marginTop: 10 }}>{cliente.nome}</Text>
              {cliente.status && (
                <View style={[s.statusBadge, { backgroundColor: STATUS_CORES[cliente.status]?.bg || C.cinzaClaro, marginTop: 6 }]}>
                  <Text style={[s.statusTexto, { color: STATUS_CORES[cliente.status]?.text || C.cinza }]}>{cliente.status}</Text>
                </View>
              )}
            </View>

            <View style={s.perfilLinha}>
              <Text style={s.perfilIcone}>📱</Text>
              <View>
                <Text style={s.perfilLabel}>Telefone</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${formatarTelefoneWA(cliente.telefone)}`)}>
                  <Text style={[s.perfilValor, { color: C.wa }]}>{cliente.telefone || '—'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {cliente.email ? (
              <View style={s.perfilLinha}>
                <Text style={s.perfilIcone}>✉️</Text>
                <View>
                  <Text style={s.perfilLabel}>E-mail</Text>
                  <Text style={s.perfilValor}>{cliente.email}</Text>
                </View>
              </View>
            ) : null}

            <View style={s.perfilLinha}>
              <Text style={s.perfilIcone}>💼</Text>
              <View>
                <Text style={s.perfilLabel}>Perfil profissional</Text>
                <Text style={s.perfilValor}>{cliente.perfil}</Text>
              </View>
            </View>

            <View style={s.perfilLinha}>
              <Text style={s.perfilIcone}>💰</Text>
              <View>
                <Text style={s.perfilLabel}>Renda familiar</Text>
                <Text style={s.perfilValor}>{formatarRenda(cliente.renda)} · {getLabelFaixa(cliente.faixa)}</Text>
              </View>
            </View>

            {cliente.empreendimento ? (
              <View style={s.perfilLinha}>
                <Text style={s.perfilIcone}>🏠</Text>
                <View>
                  <Text style={s.perfilLabel}>Empreendimento</Text>
                  <Text style={s.perfilValor}>{cliente.empreendimento}</Text>
                </View>
              </View>
            ) : null}

            {cliente.corretorNome ? (
              <View style={s.perfilLinha}>
                <Text style={s.perfilIcone}>👤</Text>
                <View>
                  <Text style={s.perfilLabel}>Corretor responsável</Text>
                  <Text style={s.perfilValor}>{cliente.corretorNome}</Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity style={[s.btnCancelar, { marginTop: 16 }]} onPress={() => setPerfilModal(false)}>
              <Text style={s.btnCancelarTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── DOC ITEM ─────────────────────────────────────────────────────────────────
function DocItem({ doc, onToggle, onSalvarObs, onSalvarAnexo, onRemoverAnexo }: {
  doc: Documento;
  onToggle: (id: number) => void;
  onSalvarObs: (id: number, obs: string) => void;
  onSalvarAnexo: (id: number, base64: string, nome: string, tipo: string) => void;
  onRemoverAnexo: (id: number) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [obs, setObs] = useState(doc.observacao || '');
  const [salvo, setSalvo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleSalvar() {
    onSalvarObs(doc.id, obs);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  function handleExcluirObs() {
    setObs('');
    onSalvarObs(doc.id, '');
    setSalvo(false);
  }

  function handleAnexar() {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = async (e: any) => {
        const file: File = e.target.files[0];
        if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) {
          alert('Arquivo muito grande. Máximo 1.5MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          onSalvarAnexo(doc.id, base64, file.name, file.type);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  }

  function handleAbrirAnexo() {
    if (!doc.arquivoBase64 || !doc.arquivoTipo) return;
    const byteChars = atob(doc.arquivoBase64);
    const byteNums = new Array(byteChars.length).fill(0).map((_, i) => byteChars.charCodeAt(i));
    const blob = new Blob([new Uint8Array(byteNums)], { type: doc.arquivoTipo });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <View style={[s.docCard, doc.entregue && s.docCardEntregue]}>
      <TouchableOpacity style={s.docRow} onPress={() => setExpandido(!expandido)} activeOpacity={0.7}>
        <TouchableOpacity style={s.checkbox} onPress={() => onToggle(doc.id)}>
          <View style={[s.checkboxBox, doc.entregue && s.checkboxAtivo]}>
            {doc.entregue && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.docNome, doc.entregue && s.docNomeEntregue]}>{doc.nome}</Text>
          <Text style={s.docSub}>{doc.sub}</Text>
          {doc.observacao ? (
            <Text style={s.obsPreview} numberOfLines={1}>💬 {doc.observacao}</Text>
          ) : null}
          {doc.arquivoNome ? (
            <Text style={s.anexoPreview} numberOfLines={1}>📎 {doc.arquivoNome}</Text>
          ) : null}
        </View>
        {!doc.entregue && (
          <View style={s.badgePendente}>
            <Text style={s.badgePendenteTexto}>Pendente</Text>
          </View>
        )}
        <Text style={{ fontSize: 11, color: C.cinza, marginLeft: 6 }}>{expandido ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandido && (
        <View style={s.obsBox}>
          {/* Observação */}
          <Text style={s.obsLabel}>Observação</Text>
          <TextInput
            style={s.obsInput}
            placeholder="Ex: Cliente vai enviar na segunda-feira"
            value={obs}
            onChangeText={t => { setObs(t); setSalvo(false); }}
            multiline
            placeholderTextColor={C.cinza}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <TouchableOpacity style={s.obsExcluir} onPress={handleExcluirObs}>
              <Text style={s.obsExcluirTexto}>🗑 Excluir</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {salvo && <Text style={{ fontSize: 12, color: C.verdeMedio, fontWeight: '500' }}>✓ Salvo</Text>}
              <TouchableOpacity style={s.obsSalvar} onPress={handleSalvar}>
                <Text style={s.obsSalvarTexto}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Anexo */}
          <View style={{ height: 1, backgroundColor: C.cinzaBorda, marginVertical: 12 }} />
          <Text style={s.obsLabel}>Anexo</Text>
          {doc.arquivoNome ? (
            <View style={s.anexoCard}>
              <TouchableOpacity style={{ flex: 1 }} onPress={handleAbrirAnexo}>
                <Text style={s.anexoNome} numberOfLines={1}>📎 {doc.arquivoNome}</Text>
                <Text style={{ fontSize: 11, color: C.cinza }}>Toque para abrir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.anexoRemover} onPress={() => onRemoverAnexo(doc.id)}>
                <Text style={s.obsExcluirTexto}>🗑</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.btnAnexar} onPress={handleAnexar}>
              <Text style={s.btnAnexarTexto}>📎 Anexar arquivo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bege },

  // LOGIN
  loginBg: { flex: 1, backgroundColor: C.verde, paddingHorizontal: 20 },
  loginTopo: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 80 : 60, paddingBottom: 32 },
  loginLogoBox: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  loginLogoCheck: { fontSize: 34, color: C.dourado },
  loginNome: { fontSize: 36, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  loginTagline: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 6 },
  loginCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, maxWidth: 420, alignSelf: 'center', width: '100%' },
  loginCardTitulo: { fontSize: 22, fontWeight: '700', color: C.texto },
  loginCardSub: { fontSize: 13, color: C.cinza, marginTop: 4, marginBottom: 8 },
  loginBotao: { backgroundColor: C.verde, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  loginBotaoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  loginErro: { color: C.erro, fontSize: 13, marginTop: 8, textAlign: 'center' },
  loginRodape: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 24, paddingBottom: 24 },

  // HEADER
  header: { backgroundColor: C.verde, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, paddingHorizontal: 20 },
  headerLogo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(201,168,76,0.2)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', alignItems: 'center', justifyContent: 'center' },
  logoCheck: { fontSize: 16, color: C.dourado },
  headerNome: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 2 },
  headerStats: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 24, gap: 24 },
  headerStatItem: { alignItems: 'center' },
  headerStatNum: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  headerDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  // NAVBAR
  navbar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.cinzaBorda, paddingBottom: Platform.OS === 'ios' ? 24 : 8, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navIcone: { fontSize: 20 },
  navLabel: { fontSize: 11, color: C.cinza },
  navLabelAtivo: { color: C.verde, fontWeight: '600' },
  navDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  // FAB
  fab: { position: 'absolute', bottom: Platform.OS === 'ios' ? 90 : 70, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.verde, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  fabIcon: { fontSize: 30, color: C.dourado, lineHeight: 34 },

  // BUSCA E FILTROS
  inputBusca: { backgroundColor: '#fff', borderRadius: 14, padding: 12, fontSize: 14, color: C.texto, borderWidth: 1, borderColor: C.cinzaBorda },
  chipFiltro: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', marginRight: 6, borderWidth: 1, borderColor: C.cinzaBorda },
  chipFiltroAtivo: { backgroundColor: C.verde, borderColor: C.verde },
  chipFiltroTexto: { fontSize: 12, color: C.cinza, fontWeight: '500' },
  chipFiltroTextoAtivo: { color: '#fff', fontWeight: '700' },

  // CARDS CLIENTES
  cardWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardNome: { fontSize: 14, fontWeight: '600', color: C.texto },
  cardSub: { fontSize: 12, color: C.cinza, marginTop: 2 },
  cardEmpre: { fontSize: 11, color: C.textoSub, marginTop: 2 },
  cardPct: { fontSize: 15, fontWeight: '700', color: C.dourado, marginLeft: 8 },
  miniBarFundo: { height: 3, backgroundColor: '#F0EDE8', borderRadius: 2, marginTop: 6 },
  miniBarFill: { height: 3, borderRadius: 2 },
  btnLixeira: { padding: 10, marginLeft: 4 },

  // AVATAR
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.verde, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: C.dourado, fontWeight: '700', fontSize: 14 },

  // STATUS
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusTexto: { fontSize: 11, fontWeight: '600' },
  statusOpcao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, backgroundColor: C.cinzaClaro, borderWidth: 1, borderColor: 'transparent' },

  // BADGE PARADO
  badgeParado: { backgroundColor: C.laranjaClaro, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeParadoTexto: { fontSize: 10, color: C.laranja, fontWeight: '700' },

  // PERFIL CLIENTE
  perfilLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.cinzaBorda },
  perfilIcone: { fontSize: 18, width: 24, textAlign: 'center' },
  perfilLabel: { fontSize: 11, color: C.cinza, fontWeight: '500' },
  perfilValor: { fontSize: 14, color: C.texto, fontWeight: '500', marginTop: 2 },

  // FORMULÁRIO
  label: { fontSize: 12, fontWeight: '600', color: C.textoSub, marginBottom: 5, marginTop: 14 },
  input: { backgroundColor: C.cinzaClaro, borderRadius: 12, padding: 13, fontSize: 14, color: C.texto },

  // MODAL
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalAlca: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.cinzaBorda, alignSelf: 'center', marginBottom: 16 },
  modalTitulo: { fontSize: 20, fontWeight: '700', color: C.texto },
  modalFechar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.cinzaClaro, alignItems: 'center', justifyContent: 'center' },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancelar: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.cinzaClaro, alignItems: 'center' },
  btnCancelarTexto: { color: C.textoSub, fontWeight: '600', fontSize: 14 },
  btnSalvar: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.verde, alignItems: 'center' },
  btnSalvarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // PERFIL / FAIXA
  opcoes: { flexDirection: 'row', gap: 8, marginTop: 4 },
  opcao: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: C.cinzaClaro, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: C.verde },
  opcaoTexto: { fontSize: 12, color: C.textoSub, fontWeight: '500' },
  opcaoTextoAtivo: { color: '#fff', fontWeight: '700' },
  faixaBox: { borderRadius: 10, padding: 10, marginTop: 8 },
  faixaBoxOk: { backgroundColor: C.verdeClaro },
  faixaBoxErro: { backgroundColor: C.erroClaro },
  faixaTexto: { fontSize: 12, fontWeight: '500' },

  // DASHBOARD
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 11, color: C.cinza, marginTop: 4 },
  secaoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  secaoTitulo: { fontSize: 14, fontWeight: '700', color: C.texto },

  // CONFIGURAÇÕES
  configPerfil: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  secaoLabel: { fontSize: 11, fontWeight: '700', color: C.cinza, letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  configRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  configRowIcon: { fontSize: 18 },
  configRowLabel: { fontSize: 14, color: C.texto, fontWeight: '500' },
  configRowSeta: { fontSize: 20, color: C.cinza, marginLeft: 'auto' },
  badgeAtivo: { backgroundColor: C.verdeClaro, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  badgeAtivoTexto: { fontSize: 11, color: C.verdeMedio, fontWeight: '600' },
  toggle: { width: 46, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleOn: { backgroundColor: C.verdeMedio },
  toggleOff: { backgroundColor: C.cinzaClaro },
  toggleDot: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  btnLogout: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: C.erroClaro, marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnLogoutTexto: { color: C.erro, fontWeight: '700', fontSize: 14 },

  // CHECKLIST
  docCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.cinzaBorda },
  docCardEntregue: { borderColor: C.verdeClaro, backgroundColor: '#F7FBF9' },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  docNome: { fontSize: 13, fontWeight: '600', color: C.texto },
  docNomeEntregue: { color: C.verdeMedio, textDecorationLine: 'line-through' },
  docSub: { fontSize: 11, color: C.cinza, marginTop: 2 },
  checkbox: { padding: 2 },
  checkboxBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.cinzaBorda, alignItems: 'center', justifyContent: 'center' },
  checkboxAtivo: { backgroundColor: C.verdeMedio, borderColor: C.verdeMedio },
  badgePendente: { backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgePendenteTexto: { fontSize: 10, color: '#E65100', fontWeight: '600' },
  obsBox: { borderTopWidth: 1, borderTopColor: C.cinzaBorda, padding: 14 },
  obsLabel: { fontSize: 11, fontWeight: '600', color: C.cinza, marginBottom: 6 },
  obsPreview: { fontSize: 11, color: C.cinza, marginTop: 3, fontStyle: 'italic' },
  anexoPreview: { fontSize: 11, color: C.verde, marginTop: 2, fontStyle: 'italic' },
  obsInput: { backgroundColor: C.cinzaClaro, borderRadius: 10, padding: 10, fontSize: 13, color: C.texto, minHeight: 60 },
  obsSalvar: { backgroundColor: C.verde, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  obsSalvarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  obsExcluir: { backgroundColor: C.erroClaro, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  obsExcluirTexto: { color: C.erro, fontSize: 12, fontWeight: '600' },
  btnAnexar: { backgroundColor: C.cinzaClaro, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.cinzaBorda, borderStyle: 'dashed' as any },
  btnAnexarTexto: { color: C.textoSub, fontSize: 13, fontWeight: '500' },
  anexoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.verdeClaro, borderRadius: 10, padding: 10, gap: 10 },
  anexoNome: { fontSize: 13, color: C.verde, fontWeight: '500' },
  anexoRemover: { padding: 4 },
  btnWA: { backgroundColor: C.wa, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnWATexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnEmail: { backgroundColor: C.verde, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnEmailTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnExcluir: { backgroundColor: C.erroClaro, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnExcluirTexto: { color: C.erro, fontWeight: '700', fontSize: 14 },
});
