import AsyncStorage from '@react-native-async-storage/async-storage';
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

type Perfil = 'CLT' | 'Autônomo' | 'Func. Público';

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
  id: number;
  nome: string;
  telefone: string;
  perfil: Perfil;
  renda: number;
  faixa: string;
  empreendimento: string;
  docs: Documento[];
}

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

const clientesIniciais: Cliente[] = [
  {
    id: 1, nome: 'Maria da Silva', telefone: '', perfil: 'CLT',
    renda: 3200, faixa: calcularFaixa(3200), empreendimento: 'Mirante Belvedere',
    docs: inicializarDocs('CLT').map((d, i) => ({ ...d, entregue: i < 4 })),
  },
  {
    id: 2, nome: 'José Oliveira', telefone: '', perfil: 'Autônomo',
    renda: 1800, faixa: calcularFaixa(1800), empreendimento: '',
    docs: inicializarDocs('Autônomo').map((d, i) => ({ ...d, entregue: i < 6 })),
  },
  {
    id: 3, nome: 'Ana Mendes', telefone: '', perfil: 'CLT',
    renda: 5000, faixa: calcularFaixa(5000), empreendimento: '',
    docs: inicializarDocs('CLT').map(d => ({ ...d, entregue: true })),
  },
];

export default function HomeScreen() {
  const [tela, setTela] = useState<'lista' | 'checklist'>('lista');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<Perfil>('CLT');
  const [novaRenda, setNovaRenda] = useState('');
  const [novoEmpreendimento, setNovoEmpreendimento] = useState('');

  const faixaPreview = novaRenda ? calcularFaixa(parseFloat(novaRenda.replace(',', '.'))) : null;

  useEffect(() => { carregarClientes(); }, []);

  async function carregarClientes() {
    try {
      const dados = await AsyncStorage.getItem('clientes_v3');
      if (dados) setClientes(JSON.parse(dados));
      else {
        setClientes(clientesIniciais);
        await AsyncStorage.setItem('clientes_v3', JSON.stringify(clientesIniciais));
      }
    } catch { setClientes(clientesIniciais); }
    finally { setCarregando(false); }
  }

  async function salvarClientes(lista: Cliente[]) {
    try { await AsyncStorage.setItem('clientes_v3', JSON.stringify(lista)); }
    catch (e) { console.log('Erro ao salvar:', e); }
  }

  function abrirCliente(cliente: Cliente) {
    setClienteSelecionado(cliente);
    setTela('checklist');
  }

  function adicionarCliente() {
    if (!novoNome.trim() || !novaRenda.trim()) return;
    const renda = parseFloat(novaRenda.replace(',', '.'));
    if (isNaN(renda) || renda <= 0) return;
    const novo: Cliente = {
      id: Date.now(), nome: novoNome.trim(), telefone: novoTelefone.trim(),
      perfil: novoPerfil, renda, faixa: calcularFaixa(renda),
      empreendimento: novoEmpreendimento.trim(), docs: inicializarDocs(novoPerfil),
    };
    const novaLista = [...clientes, novo];
    setClientes(novaLista);
    salvarClientes(novaLista);
    setNovoNome(''); setNovoTelefone(''); setNovoPerfil('CLT');
    setNovaRenda(''); setNovoEmpreendimento('');
    setModalAberto(false);
  }

  function atualizarCliente(clienteAtualizado: Cliente) {
    const novaLista = clientes.map(c => c.id === clienteAtualizado.id ? clienteAtualizado : c);
    setClientes(novaLista);
    salvarClientes(novaLista);
    setClienteSelecionado(clienteAtualizado);
  }

  if (carregando) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: '#888', fontSize: 15 }}>Carregando...</Text>
    </View>
  );

  if (tela === 'checklist' && clienteSelecionado) return (
    <ChecklistScreen cliente={clienteSelecionado} voltar={() => setTela('lista')} onAtualizar={atualizarCliente} />
  );

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
          const entregues = c.docs.filter(d => d.entregue).length;
          const total = c.docs.length;
          const pct = Math.round((entregues / total) * 100);
          const pendentes = total - entregues;
          const foraDoMCMV = c.faixa === 'Fora do MCMV';
          return (
            <TouchableOpacity key={c.id} style={s.card} onPress={() => abrirCliente(c)}>
              <View style={s.avatar}>
                <Text style={s.avatarTexto}>{c.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}</Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardNome}>{c.nome}</Text>
                <Text style={s.cardPerfil}>{c.perfil} · {foraDoMCMV ? 'Fora do MCMV' : `Faixa ${c.faixa}`} · {pendentes} pendentes</Text>
                {c.empreendimento ? <Text style={s.cardEmpreendimento}>🏢 {c.empreendimento}</Text> : null}
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
            <TextInput style={s.input} placeholder="Ex: João da Silva" value={novoNome} onChangeText={setNovoNome} placeholderTextColor="#aaa" />
            <Text style={s.label}>Telefone (WhatsApp)</Text>
            <TextInput style={s.input} placeholder="Ex: 81999990000" value={novoTelefone} onChangeText={setNovoTelefone} keyboardType="phone-pad" placeholderTextColor="#aaa" />
            <Text style={s.label}>Empreendimento</Text>
            <TextInput style={s.input} placeholder="Ex: Mirante Belvedere" value={novoEmpreendimento} onChangeText={setNovoEmpreendimento} placeholderTextColor="#aaa" />
            <Text style={s.label}>Perfil profissional</Text>
            <View style={s.opcoes}>
              {(['CLT', 'Autônomo', 'Func. Público'] as Perfil[]).map(p => (
                <TouchableOpacity key={p} style={[s.opcao, novoPerfil === p && s.opcaoAtiva]} onPress={() => setNovoPerfil(p)}>
                  <Text style={[s.opcaoTexto, novoPerfil === p && s.opcaoTextoAtivo]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Renda familiar (R$)</Text>
            <TextInput style={s.input} placeholder="Ex: 3200" value={novaRenda} onChangeText={setNovaRenda} keyboardType="numeric" placeholderTextColor="#aaa" />
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
    </View>
  );
}

function ChecklistScreen({ cliente, voltar, onAtualizar }: {
  cliente: Cliente; voltar: () => void; onAtualizar: (c: Cliente) => void;
}) {
  const [docs, setDocs] = useState<Documento[]>(cliente.docs);
  const [modalObs, setModalObs] = useState<number | null>(null);
  const [obsTexto, setObsTexto] = useState('');
  const [emailModal, setEmailModal] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [editandoEmpreendimento, setEditandoEmpreendimento] = useState(false);
  const [empreendimentoTexto, setEmpreendimentoTexto] = useState(cliente.empreendimento || '');
  const [baixandoZip, setBaixandoZip] = useState(false);

  const entregues = docs.filter(d => d.entregue).length;
  const pct = Math.round((entregues / docs.length) * 100);

  function salvar(novosDocs: Documento[]) {
    setDocs(novosDocs);
    onAtualizar({ ...cliente, docs: novosDocs, empreendimento: empreendimentoTexto });
  }

  function salvarEmpreendimento() {
    setEditandoEmpreendimento(false);
    onAtualizar({ ...cliente, docs, empreendimento: empreendimentoTexto });
  }

  function toggle(i: number) {
    salvar(docs.map((d, idx) => idx === i ? { ...d, entregue: !d.entregue } : d));
  }

  function abrirObs(i: number) {
    setObsTexto(docs[i].observacao);
    setModalObs(i);
  }

  function salvarObs() {
    if (modalObs === null) return;
    salvar(docs.map((d, i) => i === modalObs ? { ...d, observacao: obsTexto } : d));
    setModalObs(null);
  }

  function abrirUpload(i: number) {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        salvar(docs.map((d, idx) => idx === i ? { ...d, arquivoBase64: base64, arquivoNome: file.name } : d));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function baixarImagem(doc: Documento) {
    if (!doc.arquivoBase64 || Platform.OS !== 'web') return;
    const a = document.createElement('a');
    a.href = doc.arquivoBase64;
    a.download = `${doc.nome.replace(/\s+/g, '_')}.png`;
    a.click();
  }

  async function baixarTodosComoZip() {
  if (Platform.OS !== 'web') return;
  const docsComArquivo = docs.filter(d => d.arquivoBase64);
  if (docsComArquivo.length === 0) {
    alert('Nenhum documento foi anexado ainda.');
    return;
  }
  setBaixandoZip(true);
  try {
    for (const doc of docsComArquivo) {
      if (!doc.arquivoBase64) continue;
      const a = document.createElement('a');
      a.href = doc.arquivoBase64;
      const ext = doc.arquivoBase64.includes('image/png') ? 'png' : 'jpg';
      a.download = `${cliente.nome.replace(/\s+/g, '_')}_${doc.nome.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
      a.click();
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (err) {
    alert('Erro ao baixar os arquivos.');
  } finally {
    setBaixandoZip(false);
  }
}

  async function enviarEmail() {
    if (!emailDestino.trim()) return;
    setEnviandoEmail(true);
    const docsEntregues = docs.filter(d => d.entregue);
    const docsPendentes = docs.filter(d => !d.entregue);
    const corpo =
      `Documentação MCMV — ${cliente.nome}\n` +
      (cliente.empreendimento ? `Empreendimento: ${cliente.empreendimento}\n` : '') +
      `\nPerfil: ${cliente.perfil} | Faixa ${cliente.faixa} | Renda R$ ${cliente.renda.toLocaleString('pt-BR')}\n\n` +
      `✅ Documentos entregues (${docsEntregues.length}):\n` +
      docsEntregues.map(d => `  • ${d.nome}`).join('\n') +
      (docsPendentes.length > 0
        ? `\n\n⏳ Documentos pendentes (${docsPendentes.length}):\n` + docsPendentes.map(d => `  • ${d.nome}`).join('\n')
        : '\n\nTodos os documentos foram entregues! ✅');

    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: 'service_5kcdmca',
          template_id: 'template_loetntf',
          user_id: 'UTaEmAAnR1rOz-qgQ',
          template_params: {
            to_email: emailDestino,
            cliente_nome: cliente.nome,
            empreendimento: cliente.empreendimento || 'Não informado',
            corpo,
          },
        }),
      });
      if (res.ok) { alert('E-mail enviado com sucesso!'); setEmailModal(false); setEmailDestino(''); }
      else alert('Erro ao enviar. Verifique as configurações do EmailJS.');
    } catch { alert('Erro de conexão ao tentar enviar o e-mail.'); }
    finally { setEnviandoEmail(false); }
  }

  function enviarWhatsApp() {
    const pendentes = docs.filter(d => !d.entregue).map(d => `- ${d.nome}`);
    const numero = cliente.telefone ? formatarTelefoneWA(cliente.telefone) : '';
    const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/';
    if (pendentes.length === 0) {
      Linking.openURL(`${base}?text=${encodeURIComponent(`Olá ${cliente.nome}! Todos os seus documentos já foram entregues. Em breve entraremos em contato com os próximos passos do seu financiamento pelo MCMV.`)}`);
      return;
    }
    const mensagem =
      `Olá ${cliente.nome}, tudo bem?\n\n` +
      `Estou verificando a documentação do seu financiamento pelo Minha Casa, Minha Vida e ainda precisamos dos seguintes documentos:\n\n` +
      `${pendentes.join('\n')}\n\n` +
      `Assim que tiver, pode me enviar por aqui mesmo ou trazer pessoalmente. Qualquer dúvida estou à disposição.`;
    Linking.openURL(`${base}?text=${encodeURIComponent(mensagem)}`);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={voltar}><Text style={s.voltar}>← Voltar</Text></TouchableOpacity>
        <Text style={s.headerTitulo}>{cliente.nome}</Text>
        <Text style={s.headerSub}>{cliente.perfil} · Faixa {cliente.faixa} · Renda R$ {cliente.renda.toLocaleString('pt-BR')}</Text>
        {cliente.telefone ? <Text style={[s.headerSub, { marginTop: 2 }]}>📱 {cliente.telefone}</Text> : null}
        {editandoEmpreendimento ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
            <TextInput style={s.inputEmpreendimento} value={empreendimentoTexto} onChangeText={setEmpreendimentoTexto} placeholder="Nome do empreendimento" placeholderTextColor="rgba(255,255,255,0.5)" autoFocus />
            <TouchableOpacity onPress={salvarEmpreendimento}><Text style={{ color: '#2ecc71', fontWeight: '600', fontSize: 13 }}>Salvar</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditandoEmpreendimento(true)} style={{ marginTop: 4 }}>
            <Text style={[s.headerSub, { color: 'rgba(255,255,255,0.9)' }]}>🏢 {empreendimentoTexto || 'Toque para adicionar empreendimento'}</Text>
          </TouchableOpacity>
        )}
        <View style={s.barraFundo}><View style={[s.barraFill, { width: `${pct}%` as any }]} /></View>
        <View style={s.barraLabels}>
          <Text style={s.barraTexto}>{entregues} de {docs.length} entregues</Text>
          <Text style={s.barraTexto}>{pct}%</Text>
        </View>
      </View>

      <ScrollView style={s.scroll}>
        <Text style={s.secao}>Documentos</Text>
        {docs.map((doc, i) => (
          <View key={doc.id} style={s.docCard}>
            <TouchableOpacity style={s.docItem} onPress={() => toggle(i)}>
              <View style={[s.circulo, doc.entregue && s.circuloOk]}>
                {doc.entregue && <Text style={s.check}>✓</Text>}
              </View>
              <View style={s.docInfo}>
                <Text style={s.docNome}>{doc.nome}</Text>
                <Text style={s.docSub}>{doc.sub}</Text>
              </View>
              <View style={[s.badge, doc.entregue ? s.badgeOk : s.badgePend]}>
                <Text style={[s.badgeTexto, doc.entregue ? s.badgeTextoOk : s.badgeTextoPend]}>
                  {doc.entregue ? 'Entregue' : 'Pendente'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={s.docAcoes}>
              <TouchableOpacity style={s.btnAcao} onPress={() => abrirObs(i)}>
                <Text style={s.btnAcaoTexto}>{doc.observacao ? '📝 Ver obs.' : '📝 Anotar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnAcao} onPress={() => abrirUpload(i)}>
                <Text style={s.btnAcaoTexto}>{doc.arquivoBase64 ? '🖼 Trocar imagem' : '📎 Anexar'}</Text>
              </TouchableOpacity>
              {doc.arquivoBase64 && (
                <TouchableOpacity style={s.btnAcao} onPress={() => baixarImagem(doc)}>
                  <Text style={s.btnAcaoTexto}>⬇ Baixar</Text>
                </TouchableOpacity>
              )}
            </View>
            {doc.observacao ? (
              <View style={s.obsBox}><Text style={s.obsTexto}>💬 {doc.observacao}</Text></View>
            ) : null}
            {doc.arquivoBase64 && Platform.OS === 'web' && (
              <View style={s.imgPreviewBox}>
                <img src={doc.arquivoBase64} alt={doc.nome} style={{ width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 8 }} />
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={s.btnZip} onPress={baixarTodosComoZip} disabled={baixandoZip}>
          <Text style={s.btnZipTexto}>{baixandoZip ? '⏳ Gerando ZIP...' : '📦 Baixar todos os documentos em PDF'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnWhatsApp} onPress={enviarWhatsApp}>
          <Text style={s.btnWhatsAppTexto}>{entregues === docs.length ? '🎉 Enviar parabéns ao cliente' : '💬 Enviar pendências pelo WhatsApp'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnEmail} onPress={() => setEmailModal(true)}>
          <Text style={s.btnEmailTexto}>📧 Enviar documentação por e-mail</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalObs !== null} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>{modalObs !== null ? docs[modalObs]?.nome : ''}</Text>
            <Text style={s.label}>Observação</Text>
            <TextInput style={[s.input, { height: 100, textAlignVertical: 'top' }]} placeholder="Ex: Cliente vai trazer na sexta-feira..." value={obsTexto} onChangeText={setObsTexto} multiline placeholderTextColor="#aaa" />
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => setModalObs(null)}><Text style={s.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={s.btnSalvar} onPress={salvarObs}><Text style={s.btnSalvarTexto}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={emailModal} animationType="slide" transparent>
        <View style={s.modalFundo}>
          <View style={s.modalBox}>
            <Text style={s.modalTitulo}>Enviar por e-mail</Text>
            <Text style={s.label}>E-mail do destinatário</Text>
            <TextInput style={s.input} placeholder="Ex: cliente@email.com" value={emailDestino} onChangeText={setEmailDestino} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#aaa" />
            <Text style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Será enviado um resumo com os documentos entregues e pendentes.</Text>
            <View style={s.modalBotoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => setEmailModal(false)}><Text style={s.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
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
  cardEmpreendimento: { fontSize: 11, color: '#1a5276', marginTop: 2 },
  pct: { fontSize: 13, fontWeight: '600', color: '#1a5276' },
  docCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  docItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  docAcoes: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  btnAcao: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  btnAcaoTexto: { fontSize: 11, color: '#555', fontWeight: '500' },
  obsBox: { backgroundColor: '#fffbea', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0e68c' },
  obsTexto: { fontSize: 12, color: '#7d6608' },
  imgPreviewBox: { padding: 10, borderTopWidth: 1, borderTopColor: '#eee' },
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
  btnZip: { backgroundColor: '#8e44ad', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnZipTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnWhatsApp: { backgroundColor: '#25D366', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  btnWhatsAppTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnEmail: { backgroundColor: '#2980b9', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, marginBottom: 32 },
  btnEmailTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { fontSize: 18, fontWeight: '600', color: '#222', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#222' },
  inputEmpreendimento: { flex: 1, color: '#fff', fontSize: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)', paddingVertical: 2 },
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