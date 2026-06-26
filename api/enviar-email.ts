import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { PDFDocument } from 'pdf-lib';

interface Anexo {
  base64: string;
  nome: string;
  tipo: string;
  docNome: string;
}

interface RequestBody {
  destinatario: string;
  replyTo: string;
  assunto: string;
  corpoTexto: string;
  anexos: Anexo[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { destinatario, replyTo, assunto, corpoTexto, anexos } = req.body as RequestBody;

    if (!destinatario || !corpoTexto) {
      return res.status(400).json({ error: 'Destinatário e corpo do e-mail são obrigatórios' });
    }

    // 1. Gerar o PDF com as imagens anexadas
    const pdfDoc = await PDFDocument.create();

    if (anexos && anexos.length > 0) {
      for (const anexo of anexos) {
        try {
          const base64Data = anexo.base64.includes(',')
            ? anexo.base64.split(',')[1]
            : anexo.base64;
          const imageBytes = Buffer.from(base64Data, 'base64');

          let image;
          if (anexo.tipo.includes('png')) {
            image = await pdfDoc.embedPng(imageBytes);
          } else if (anexo.tipo.includes('jpeg') || anexo.tipo.includes('jpg')) {
            image = await pdfDoc.embedJpg(imageBytes);
          } else {
            // Tipo não suportado para embed direto (ex: PDF já pronto) — pula
            continue;
          }

          const page = pdfDoc.addPage();
          const { width, height } = page.getSize();

          // Escala a imagem para caber na página, mantendo proporção
          const maxWidth = width - 40;
          const maxHeight = height - 80;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;

          page.drawText(`${anexo.docNome} — ${anexo.nome}`, {
            x: 20,
            y: height - 30,
            size: 10,
          });

          page.drawImage(image, {
            x: (width - scaledWidth) / 2,
            y: (height - scaledHeight) / 2 - 20,
            width: scaledWidth,
            height: scaledHeight,
          });
        } catch (imgError) {
          console.error(`Erro ao processar anexo ${anexo.nome}:`, imgError);
          // Continua para os outros anexos mesmo se um falhar
        }
      }
    }

    const pdfBytes = await pdfDoc.save();

    // 2. Configurar o transporte de e-mail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // 3. Enviar o e-mail
    await transporter.sendMail({
      from: `"Certus" <${process.env.GMAIL_USER}>`,
      to: destinatario,
      replyTo: replyTo || process.env.GMAIL_USER,
      subject: assunto || 'Documentos do Cliente — Certus',
      text: corpoTexto,
      attachments: [
        {
          filename: 'documentos.pdf',
          content: Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        },
      ],
    });

    return res.status(200).json({ success: true, message: 'E-mail enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return res.status(500).json({
      error: 'Erro ao enviar e-mail',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}