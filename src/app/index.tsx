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
  verdeClaro: '#E8F5F0',
  cinza: '#888780',
  cinzaClaro: '#F0EDE8',
  cinzaBorda: '#E8E4DE',
  texto: '#1C1C1A',
  textoSub: '#6B6A66',
  erro: '#993C1D',
  erroClaro: '#FAECE7',
  wa: '#25D366',
};

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type Perfil = 'CLT' | 'Autônomo' | 'Func. Público';
type Aba = 'clientes' | 'dashboard' | 'configuracoes';
type Role = 'corretor' | 'gestor';

interface Documento {
  id: number;
  nome: string;
  sub: string;
  entregue: boolean;
  observacao: string;
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
  corretorEmail?: string;
  gestorId?: string;
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
    setErro(''); setCarregando(true);
    try {
      if (modoCadastro) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
        const gestorId = (role === 'corretor' && gestorCodigo.trim()) ? gestorCodigo.trim() : null;
        await addDoc(collection(db, 'usuarios'), {
          uid: cred.user.uid,
          email: email.trim(),
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
    <View style={s.loginBg}>
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
  const [userRole, setUserRole] = useState<Role>('corretor');
  const [userGestorId, setUserGestorId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<Perfil>('CLT');
  const [novaRenda, setNovaRenda] = useState('');
  const [novoEmpreendimento, setNovoEmpreendimento] = useState('');
  const [modalExcluirCliente, setModalExcluirCliente] = useState<Cliente | null>(null);

  const faixaPreview = novaRenda ? calcularFaixa(parseFloat(novaRenda.replace(',', '.'))) : null;

  // Busca o perfil do usuário (role e gestorId)
  useEffect(() => {
    const q = query(collection(db, 'usuarios'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setUserRole(data.role || 'corretor');
        setUserGestorId(data.gestorId || null);
      }
    });
    return unsubscribe;
  }, [user.uid]);

  // Busca clientes: corretor vê só os seus; gestor vê os dos corretores vinculados a ele
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
        nome: novoNome.trim(), telefone: novoTelefone.trim(),
        perfil: novoPerfil, renda, faixa: calcularFaixa(renda),
        empreendimento: novoEmpreendimento.trim(),
        docs: inicializarDocs(novoPerfil),
        corretorId: user.uid,
        corretorEmail: user.email,
        gestorId: userGestorId || null,
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
              <Text style={s.headerStatLabel}>
                {userRole === 'gestor' ? 'Clientes da equipe' : 'Clientes ativos'}
              </Text>
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
            clientes={clientes}
            userRole={userRole}
            onAbrirCliente={(c) => { setClienteSelecionado(c); setTela('checklist'); }}
            onExcluirCliente={setModalExcluirCliente}
          />
        )}
        {abaAtiva === 'dashboard' && <TelaDashboard clientes={clientes} />}
        {abaAtiva === 'configuracoes' && <TelaConfiguracoes user={user} userRole={userRole} />}
      </View>

      {/* FAB — gestor não adiciona clientes */}
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
          <View style={s.modalBox}>
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
function TelaClientes({ clientes, userRole, onAbrirCliente, onExcluirCliente }: {
  clientes: Cliente[];
  userRole: Role;
  onAbrirCliente: (c: Cliente) => void;
  onExcluirCliente: (c: Cliente) => void;
}) {
  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} contentContainerStyle={{ paddingBottom: 100 }}>
      {clientes.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>📋</Text>
          <Text style={{ color: C.cinza, fontSize: 14, textAlign: 'center' }}>
            {userRole === 'gestor'
              ? 'Nenhum cliente da equipe ainda.\nCorretores precisam informar seu código ao criar conta.'
              : 'Nenhum cliente ainda.\nToque no + para adicionar.'}
          </Text>
        </View>
      )}
      {clientes.map(c => {
        const entregues = c.docs.filter(d => d.entregue).length;
        const total = c.docs.length;
        const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;
        const pendentes = total - entregues;
        const fora = c.faixa === 'Fora do MCMV';
        return (
          <View key={c.id} style={s.cardWrapper}>
            <TouchableOpacity style={s.card} onPress={() => onAbrirCliente(c)} activeOpacity={0.7}>
              <View style={s.avatar}>
                <Text style={s.avatarTexto}>{getIniciais(c.nome)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.cardNome}>{c.nome}</Text>
                <Text style={s.cardSub}>{c.perfil} · {getLabelFaixa(c.faixa)} · {pendentes} pendentes</Text>
                {c.empreendimento ? <Text style={s.cardEmpre}>{c.empreendimento}</Text> : null}
                {userRole === 'gestor' && c.corretorEmail ? (
                  <Text style={[s.cardEmpre, { color: C.dourado, fontWeight: '500' }]}>
                    👤 {c.corretorEmail}
                  </Text>
                ) : null}
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
function TelaConfiguracoes({ user, userRole }: { user: User; userRole: Role }) {
  const [novaSenha, setNovaSenha] = useState('');
  const [modalSenha, setModalSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState(false);
  const [notif, setNotif] = useState(true);

  async function alterarSenha() {
    if (novaSenha.length < 6) { setErroSenha('Mínimo 6 caracteres.'); return; }
    try {
      await updatePassword(user, novaSenha);
      setSucessoSenha(true); setNovaSenha('');
      setTimeout(() => { setModalSenha(false); setSucessoSenha(false); }, 1500);
    } catch { setErroSenha('Erro ao alterar. Faça login novamente.'); }
  }

  const iniciais = user.email?.slice(0, 2).toUpperCase() || 'JM';

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.configPerfil}>
        <View style={[s.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
          <Text style={[s.avatarTexto, { fontSize: 18 }]}>{iniciais}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.texto }}>{user.email}</Text>
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

      {userRole === 'gestor' && (
        <>
          <Text style={s.secaoLabel}>EQUIPE</Text>
          <View style={s.secaoCard}>
            <View style={s.configRow}>
              <Text style={s.configRowIcon}>🔑</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.configRowLabel}>Seu código de gestor</Text>
                <Text style={{ fontSize: 11, color: C.cinza, marginTop: 2 }}>
                  Compartilhe com seus corretores ao criar a conta deles
                </Text>
                <Text style={{ fontSize: 11, color: C.dourado, fontWeight: '700', marginTop: 6 }}>
                  {user.uid}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      <Text style={s.secaoLabel}>NOTIFICAÇÕES</Text>
      <View style={s.secaoCard}>
        <View style={s.configRow}>
          <Text style={s.configRowIcon}>🔔</Text>
          <Text style={[s.configRowLabel, { flex: 1 }]}>Notificações push</Text>
          <TouchableOpacity
            style={[s.toggle, notif ? s.toggleOn : s.toggleOff]}
            onPress={() => setNotif(!notif)}
          >
            <View style={[s.toggleDot, { left: notif ? 22 : 2 }]} />
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

  const entregues = cliente.docs.filter(d => d.entregue).length;
  const total = cliente.docs.length;
  const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;
  const waLink = `https://wa.me/${formatarTelefoneWA(cliente.telefone)}`;

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

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={voltar} style={{ marginBottom: 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' }}>{cliente.nome}</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 2 }}>
          {cliente.perfil} · {getLabelFaixa(cliente.faixa)}{cliente.empreendimento ? ` · ${cliente.empreendimento}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
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
          <DocItem key={doc.id} doc={doc} onToggle={toggleDoc} onSalvarObs={salvarObs} />
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
    </View>
  );
}

// ─── DOC ITEM ─────────────────────────────────────────────────────────────────
function DocItem({ doc, onToggle, onSalvarObs }: {
  doc: Documento;
  onToggle: (id: number) => void;
  onSalvarObs: (id: number, obs: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [obs, setObs] = useState(doc.observacao || '');
  const [salvo, setSalvo] = useState(false);

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
  obsInput: { backgroundColor: C.cinzaClaro, borderRadius: 10, padding: 10, fontSize: 13, color: C.texto, minHeight: 60 },
  obsSalvar: { backgroundColor: C.verde, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  obsSalvarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  obsExcluir: { backgroundColor: C.erroClaro, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  obsExcluirTexto: { color: C.erro, fontSize: 12, fontWeight: '600' },
  btnWA: { backgroundColor: C.wa, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnWATexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnEmail: { backgroundColor: C.verde, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnEmailTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnExcluir: { backgroundColor: C.erroClaro, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnExcluirTexto: { color: C.erro, fontWeight: '700', fontSize: 14 },
});
