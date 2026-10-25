/**
 * DOCX 导出。
 *
 * 为什么要有这条路径：很多招聘系统（尤其国企/外企的 ATS 与内推表单）
 * 只接受 .docx 上传，打印出来的 PDF 反而被拒。
 *
 * 生成的是「单栏、纯文本结构」的 ATS 友好版式，不追求还原模板外观 ——
 * 双栏、图形、背景色在 Word 里会被 ATS 解析成一堆碎片，得不偿失。
 * 因此导出弹窗里会明确标注这一点。
 *
 * `docx` 包较大（~600KB），全部走动态 import，只有用户真的点「导出 Word」才加载。
 */

import type { ResumeContent } from '../types/resume';
import { formatDateRange, joinList, normalizeLocale } from '../i18n/resumeLabels';

/** 导出文档里的固定文案；英文简历里出现「个人简介」会很突兀 */
const DOCX_TEXT = {
  'zh-CN': { summary: '个人简介', docTitle: '个人简历', description: '由 OpenResume 导出的简历（ATS 友好单栏版式）', font: 'Microsoft YaHei' },
  en: { summary: 'Summary', docTitle: 'Resume', description: 'Resume exported from OpenResume (ATS-friendly single column)', font: 'Calibri' }
} as const;

/** 描述按行拆成段落文本（去掉用户自己写的 bullet 前缀，交给 Word 编号） */
function descriptionLines(description: string): string[] {
  return String(description || '')
    .split('\n')
    .map((line) => line.trim().replace(/^[-•·]\s*/, ''))
    .filter(Boolean);
}

/**
 * 生成 DOCX 并触发下载。
 *
 * 返回文件名，便于调用方给 Toast 提示。
 */
export async function exportDocx(input: {
  title: string;
  content: ResumeContent;
  filename: string;
}): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } =
    await import('docx');

  const { content } = input;
  const { profile, modules, modulesOrder } = content;
  const locale = normalizeLocale(content.locale);
  const text = DOCX_TEXT[locale];
  const dateRange = (start?: string, end?: string) => formatDateRange(start, end, locale);

  const children: any[] = [];

  // ---- 抬头 ----
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: profile.name || input.title || text.docTitle, bold: true, size: 40 })]
    })
  );

  const headline = [profile.title, profile.workYears, profile.location].filter(Boolean).join(' · ');
  if (headline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: headline, size: 22, color: '444444' })]
      })
    );
  }

  const contacts = [profile.phone, profile.email, profile.github, profile.website].filter(Boolean);
  if (contacts.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: contacts.join('  |  '), size: 20, color: '666666' })]
      })
    );
  }

  /** 章节标题：带下边框的粗体，比 Heading 样式更紧凑，也更容易被 ATS 识别为分段 */
  const sectionTitle = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 2 }
      },
      children: [new TextRun({ text, bold: true, size: 26 })]
    });

  const bullet = (text: string) =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 40 },
      children: [new TextRun({ text, size: 21 })]
    });

  if (profile.summary) {
    children.push(sectionTitle(text.summary));
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: profile.summary, size: 21 })]
      })
    );
  }

  for (const key of modulesOrder) {
    // 每个分支取具体模块而不是 `modules[key]`：后者的类型是「所有模块的联合」，
    // 拿不到 items 的元素类型，逐字段访问会全部报错
    if (key === 'work') {
      const mod = modules.work;
      if (!mod.visible || !mod.items.length) continue;
      children.push(sectionTitle(mod.title));
      for (const item of mod.items) {
        const range = dateRange(item.startDate, item.endDate);
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: [item.company, item.position].filter(Boolean).join(' · '), bold: true, size: 22 }),
              ...(range ? [new TextRun({ text: `　${range}`, size: 20, color: '666666' })] : [])
            ]
          })
        );
        for (const line of descriptionLines(item.description)) children.push(bullet(line));
      }
    }

    if (key === 'projects') {
      const mod = modules.projects;
      if (!mod.visible || !mod.items.length) continue;
      children.push(sectionTitle(mod.title));
      for (const item of mod.items) {
        const range = dateRange(item.startDate, item.endDate);
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: [item.name, item.role].filter(Boolean).join(' · '), bold: true, size: 22 }),
              ...(range ? [new TextRun({ text: `　${range}`, size: 20, color: '666666' })] : [])
            ]
          })
        );
        if (item.link) {
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: item.link, size: 19, color: '2563EB' })]
            })
          );
        }
        for (const line of descriptionLines(item.description)) children.push(bullet(line));
      }
    }

    if (key === 'education') {
      const mod = modules.education;
      if (!mod.visible || !mod.items.length) continue;
      children.push(sectionTitle(mod.title));
      for (const item of mod.items) {
        const range = dateRange(item.startDate, item.endDate);
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: [item.school, item.major, item.degree].filter(Boolean).join(' · '),
                bold: true,
                size: 21
              }),
              ...(range ? [new TextRun({ text: `　${range}`, size: 20, color: '666666' })] : [])
            ]
          })
        );
        if (item.description) children.push(bullet(item.description));
      }
    }

    if (key === 'skills') {
      const mod = modules.skills;
      if (!mod.visible || !mod.items.length) continue;
      children.push(sectionTitle(mod.title));
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: joinList(mod.items, locale), size: 21 })]
        })
      );
    }

    if (key === 'custom') {
      const mod = modules.custom;
      if (!mod.visible || !mod.items.length) continue;
      children.push(sectionTitle(mod.title));
      for (const item of mod.items) {
        for (const line of descriptionLines(item)) children.push(bullet(line));
      }
    }
  }

  const doc = new Document({
    creator: 'OpenResume',
    title: input.title || text.docTitle,
    description: text.description,
    styles: {
      default: {
        document: {
          run: { font: text.font, size: 21 }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 } // 0.5 英寸 ≈ 1.27cm
          }
        },
        children
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = input.filename.endsWith('.docx') ? input.filename : `${input.filename}.docx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
