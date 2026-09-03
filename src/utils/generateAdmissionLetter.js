const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { cloudinary, cloudinaryConfigured } = require('../config/cloudinary');

const LETTERS_DIR = path.join(__dirname, '..', '..', 'uploads', 'letters');
fs.mkdirSync(LETTERS_DIR, { recursive: true });

// Loads an image (logo / applicant photo / CEO signature) as a Buffer,
// whether it's a Cloudinary URL or a local /uploads/... path — so it can be
// handed straight to pdfkit's doc.image(), which only accepts a Buffer or a
// local file path, never a remote URL. Returns null (never throws) so a
// missing/broken image just gets skipped rather than failing the letter.
async function loadImageBuffer(urlOrPath) {
  if (!urlOrPath) return null;
  try {
    if (/^https?:\/\//i.test(urlOrPath)) {
      const res = await fetch(urlOrPath);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const localPath = path.join(__dirname, '..', '..', urlOrPath.replace(/^\/uploads/, 'uploads'));
    if (!fs.existsSync(localPath)) return null;
    return fs.readFileSync(localPath);
  } catch (e) {
    return null;
  }
}

/**
 * Generates a PDF admission letter for an admitted applicant, signed with the
 * CEO's name/title and (if uploaded) their signature image from Settings.
 * When Cloudinary is configured, the finished PDF is uploaded there (so it
 * survives restarts/deploys on hosts with an ephemeral filesystem, e.g.
 * Render) and the Cloudinary URL is returned; otherwise it's kept on local
 * disk and the relative /uploads/... path is returned, same as before.
 */
async function generateAdmissionLetter({ application, course, settings }) {
  const fileName = `${application.applicationNumber}.pdf`;
  const filePath = path.join(LETTERS_DIR, fileName);

  // Fetch every image the letter needs up front — pdfkit builds the
  // document synchronously below, so this can't be interleaved with it.
  const [logoBuffer, photoBuffer, sigBuffer] = await Promise.all([
    loadImageBuffer(settings.logoUrl),
    loadImageBuffer(application.photoUrl),
    loadImageBuffer(settings.ceoSignatureUrl),
  ]);

  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 56, 45, { width: 70 });
    } catch (e) {
      /* ignore bad image */
    }
  }

  // Applicant's photo (if they attached one to their application), top-right
  if (photoBuffer) {
    try {
      doc.image(photoBuffer, 469, 45, { width: 70, height: 70, fit: [70, 70], align: 'center', valign: 'center' });
      doc.rect(469, 45, 70, 70).strokeColor('#e6dcc0').lineWidth(1).stroke();
    } catch (e) {
      /* ignore bad image */
    }
  }

  doc
    .fontSize(18)
    .fillColor('#111827')
    .text(settings.schoolName || 'Rolen School of Fashion and Design', 140, 50, { align: 'left' })
    .fontSize(9)
    .fillColor('#6b7280')
    .text(settings.address || '', 140, 72)
    .text(`${settings.email || ''}  |  ${settings.phone || ''}`, 140, 86);

  doc.moveTo(56, 120).lineTo(539, 120).strokeColor('#c9a227').lineWidth(2).stroke();

  doc.moveDown(3);
  doc.fontSize(10).fillColor('#6b7280').text(new Date().toDateString(), 56, 140, { align: 'right' });

  doc
    .fontSize(16)
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .text('OFFER OF ADMISSION', 56, 165, { align: 'center' });

  doc.moveDown(1.5);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text(`Dear ${application.firstName} ${application.lastName},`, { align: 'left' });

  doc.moveDown(0.8);
  doc.text(
    settings.admissionLetterIntro ||
      'We are pleased to inform you that you have been offered admission to Rolen School of Fashion and Design.',
    { align: 'justify' }
  );

  doc.moveDown(0.8);
  doc.text(
    `You have been admitted to the following program:`,
    { align: 'justify' }
  );

  doc.moveDown(0.5);
  const boxTop = doc.y;
  doc.rect(56, boxTop, 483, 92).fillAndStroke('#faf7ee', '#e6dcc0');
  doc
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Program:`, 70, boxTop + 12, { continued: true })
    .font('Helvetica')
    .text(`  ${course.title}`);
  doc
    .font('Helvetica-Bold')
    .text(`Duration:`, 70, boxTop + 32, { continued: true })
    .font('Helvetica')
    .text(`  ${course.duration}`);
  doc
    .font('Helvetica-Bold')
    .text(`Intake:`, 70, boxTop + 52, { continued: true })
    .font('Helvetica')
    .text(`  ${application.intakePeriod || 'Next available intake'}`);
  doc
    .font('Helvetica-Bold')
    .text(`Application No.:`, 70, boxTop + 72, { continued: true })
    .font('Helvetica')
    .text(`  ${application.applicationNumber}`);

  doc.y = boxTop + 110;
  doc.moveDown(0.8);
  // Fee is optional (courses can be published without a published price —
  // see Course.js / CourseCard.js's "Contact us for pricing" fallback), so
  // this must degrade gracefully instead of printing "GHS NaN".
  const tuitionLine =
    course.fee != null
      ? `Tuition for this program is ${course.feeCurrency || 'GHS'} ${Number(course.fee).toLocaleString()}.`
      : 'Please contact the admissions office for current tuition information.';
  doc.font('Helvetica').fontSize(11).text(
    `${tuitionLine} Please contact the admissions office regarding payment plans, orientation dates, and required documents. This offer is conditional upon meeting all outstanding admission requirements.`,
    { align: 'justify' }
  );

  doc.moveDown(0.8);
  doc.text('We look forward to welcoming you and supporting your growth as a fashion creative.', { align: 'justify' });

  doc.moveDown(2.5);

  // Signature block
  const sigY = doc.y;
  if (sigBuffer) {
    try {
      doc.image(sigBuffer, 56, sigY, { width: 140, height: 55, fit: [140, 55] });
    } catch (e) {
      /* ignore bad image */
    }
  }
  doc.moveTo(56, sigY + 60).lineTo(230, sigY + 60).strokeColor('#111827').lineWidth(1).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(settings.ceoName || 'Chief Executive Officer', 56, sigY + 66);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(settings.ceoTitle || 'Chief Executive Officer', 56, sigY + 82);

  // Footer
  doc
    .fontSize(8)
    .fillColor('#9ca3af')
    .text(
      `This letter was generated electronically by ${settings.schoolName || 'Rolen School of Fashion and Design'} and is valid without a physical stamp. Verify at ${settings.email || ''}.`,
      56,
      760,
      { width: 483, align: 'center' }
    );

  // Second page: List of Materials / Fabrics Needed, plus the Fees & Payment
  // Schedule (all set in Admin → Settings) — printed together with the
  // letter so an admitted student has everything in one document. Each
  // section is independently optional; the page itself is skipped entirely
  // if all three are empty.
  const materialsList = (settings.materialsList || []).filter(Boolean);
  const fabricsList = (settings.fabricsList || []).filter(Boolean);
  const paymentScheduleText = (settings.paymentScheduleText || '').trim();

  if (materialsList.length > 0 || fabricsList.length > 0 || paymentScheduleText) {
    doc.addPage();

    let isFirstSection = true;
    function sectionHeading(title) {
      if (isFirstSection) {
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(title, 56, 56, { underline: true });
      } else {
        doc.moveDown(1.5);
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(title, { underline: true });
      }
      isFirstSection = false;
    }

    if (materialsList.length > 0) {
      sectionHeading('LIST OF MATERIALS');
      doc.moveDown(0.8);
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#111827')
        .text('Students are required to purchase the following materials for school:', { align: 'left' });
      doc.moveDown(0.5);
      materialsList.forEach((item, i) => {
        doc.text(`${i + 1}.  ${item}`, { indent: 12 });
      });
    }

    if (fabricsList.length > 0) {
      sectionHeading('FABRICS NEEDED');
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(11).fillColor('#111827');
      fabricsList.forEach((item, i) => {
        doc.text(`${i + 1}.  ${item}`, { indent: 12 });
      });
    }

    if (settings.materialsNote) {
      doc.moveDown(1.2);
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .fillColor('#6b7280')
        .text(settings.materialsNote, { align: 'left' });
    }

    if (paymentScheduleText) {
      sectionHeading('FEES AND PAYMENT SCHEDULE');
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(11).fillColor('#111827').text(paymentScheduleText, { align: 'justify' });
    }
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  if (cloudinaryConfigured) {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'raw',
      folder: 'rolen/letters',
      public_id: `${application.applicationNumber}.pdf`,
      overwrite: true,
    });
    // Local copy was only ever a staging step for the Cloudinary upload —
    // clean it up so it doesn't sit on the (ephemeral anyway) disk.
    fs.unlink(filePath, () => {});
    return result.secure_url;
  }

  return `/uploads/letters/${fileName}`;
}

module.exports = generateAdmissionLetter;
