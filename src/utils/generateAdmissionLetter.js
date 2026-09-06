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

// Draws a large, faint, rotated copy of the school logo centered on the
// current page, behind everything else — a watermark. Must be called before
// any other drawing on that page (pdfkit layers each call on top of the
// last), and wraps the rotation/opacity change in save()/restore() so it
// never leaks into the header/text drawn afterward.
function drawWatermark(doc, logoBuffer) {
  if (!logoBuffer) return;
  try {
    const { width: pageWidth, height: pageHeight } = doc.page;
    const size = 340;
    doc.save();
    doc.opacity(0.07);
    doc.rotate(-35, { origin: [pageWidth / 2, pageHeight / 2] });
    doc.image(logoBuffer, pageWidth / 2 - size / 2, pageHeight / 2 - size / 2, { width: size, height: size, fit: [size, size] });
    doc.restore();
  } catch (e) {
    /* ignore bad image */
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

  // Watermark first — everything else on this page draws on top of it.
  drawWatermark(doc, logoBuffer);

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

  // Eric: "Only one number is showing on the admission letter. Show both
  // numbers on it." — `settings.phone` (the plain call line) and
  // `settings.whatsapp` (the separate WhatsApp-only line, see
  // Settings.phone/Settings.whatsapp above) are genuinely different numbers,
  // so both are printed here, alongside the email, same as the Contact page
  // already shows both independently. Constrained to the space left of the
  // applicant's photo box (which starts at x=469) so it can never run under
  // it; wraps to a second line on its own if ever too long for one.
  const contactParts = [settings.email, settings.phone, settings.whatsapp].filter(Boolean);

  doc
    .fontSize(18)
    .fillColor('#111827')
    .text(settings.schoolName || 'Rolen School of Fashion and Design', 140, 50, { align: 'left' })
    .fontSize(9)
    .fillColor('#6b7280')
    .text(settings.address || '', 140, 72)
    .text(contactParts.join('  |  '), 140, 86, { width: 320 });

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

  // Pulled up from below the second-page build-out so the referral sentence
  // on THIS page can name only the sections that will actually appear on
  // page two (each of the four is independently optional there).
  const materialsList = (settings.materialsList || []).filter(Boolean);
  const fabricsList = (settings.fabricsList || []).filter(Boolean);
  const paymentScheduleText = (settings.paymentScheduleText || '').trim();
  const scheduleText = (settings.scheduleText || '').trim();
  const hasPageTwo = materialsList.length > 0 || fabricsList.length > 0 || paymentScheduleText || scheduleText;

  // Tuition now always reflects the SPECIFIC class the student was admitted
  // to (Beginner vs. Advanced carry different fees/durations) rather than a
  // single shared statement that would otherwise have to describe every
  // track's pricing at once, on every letter, regardless of which one the
  // student applied for. `settings.tuitionText` (admin-editable free text)
  // is kept only as a fallback for the rare course published without a fee
  // — see Course.js / CourseCard.js's own "Contact us for pricing" fallback
  // for the same case — so that fallback must itself degrade gracefully
  // instead of ever printing "GHS NaN".
  const tuitionLine =
    course.fee != null
      ? `Tuition for the ${course.title}, ${course.duration}, is ${course.feeCurrency || 'GHS'} ${Number(course.fee).toLocaleString()}, payable in accordance with the fees and payment schedule ${hasPageTwo ? 'set out on page two of this letter' : 'communicated by the admissions office'}.`
      : (settings.tuitionText || '').trim() || 'Please contact the admissions office for current tuition information.';
  doc.font('Helvetica').fontSize(11).text(tuitionLine, { align: 'justify' });
  doc.moveDown(0.5);

  // Second paragraph: point the student at whichever page-two sections will
  // actually be present, rather than a generic "contact the office" line —
  // built from a natural-language list so it only ever names sections that
  // exist (a course with no materials/fabrics/schedule content configured
  // still gets a coherent, non-broken sentence).
  const pageTwoParts = [];
  if (materialsList.length > 0 || fabricsList.length > 0) pageTwoParts.push('the required materials and fabrics');
  if (paymentScheduleText) pageTwoParts.push('the fees and payment schedule');
  if (scheduleText) pageTwoParts.push('the class schedule and academic terms');
  const joinWithAnd = (items) =>
    items.length <= 1 ? items.join('') : items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  const followUpLine =
    pageTwoParts.length > 0
      ? `Please refer to page two of this letter for ${joinWithAnd(pageTwoParts)}. This offer is conditional upon meeting all outstanding admission requirements, including settlement of the deposit specified in the payment schedule by the stated date.`
      : 'Please contact the admissions office regarding orientation dates and any outstanding admission requirements. This offer is conditional upon meeting all outstanding admission requirements.';
  doc.text(followUpLine, { align: 'justify' });

  doc.moveDown(0.8);
  doc.text('We look forward to welcoming you and supporting your growth as a fashion creative.', { align: 'justify' });

  doc.moveDown(2.2);

  // Signature block — the school's side of the offer.
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

  // Acceptance section — the student's side of the offer. Eric asked that
  // the letter make clear the student must sign it after printing, so this
  // gives them an actual place to do that rather than just a verbal
  // instruction: a short notice plus blank signature/date lines, laid out
  // below the CEO's signature so the printed page reads school-signs-first,
  // student-signs-second.
  doc.y = sigY + 96;
  doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#e6dcc0').lineWidth(1).stroke();
  doc.moveDown(0.9);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('ACCEPTANCE OF OFFER');
  doc.moveDown(0.35);
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#374151')
    .text('Please print this letter and sign below to confirm your acceptance of this offer of admission.', { align: 'left' });
  doc.moveDown(1.2);
  const acceptY = doc.y;
  doc.moveTo(56, acceptY).lineTo(260, acceptY).strokeColor('#111827').lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text("Student's Signature", 56, acceptY + 5);
  doc.moveTo(340, acceptY).lineTo(483, acceptY).strokeColor('#111827').lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Date', 340, acceptY + 5);

  // Footer — anchored just below the acceptance block instead of a fixed
  // y-coordinate, so it can never collide with (or float awkwardly above)
  // content whose length varies with how much page-two material exists.
  doc.moveDown(2.2);
  doc
    .fontSize(8)
    .fillColor('#9ca3af')
    .text(
      `This letter was generated electronically by ${settings.schoolName || 'Rolen School of Fashion and Design'} and is valid without a physical stamp. Verify at ${settings.email || ''}.`,
      56,
      doc.y,
      { width: 483, align: 'center' }
    );

  // Second page: List of Materials / Fabrics Needed, the Fees & Payment
  // Schedule, and the Class Schedule & Academic Terms (all set in
  // Admin → Settings) — printed together with the letter so an admitted
  // student has everything in one document. Each section is independently
  // optional; the page itself is skipped entirely if all four are empty.
  if (hasPageTwo) {
    doc.addPage();
    drawWatermark(doc, logoBuffer);

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

    if (scheduleText) {
      sectionHeading('CLASS SCHEDULE & ACADEMIC TERMS');
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(11).fillColor('#111827').text(scheduleText, { align: 'justify' });
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
      // Cloudinary blocks public delivery of PDF/ZIP files by default on every
      // account created since their 2024 security update, returning a 401 on
      // the resulting URL even though the upload itself succeeds. This makes
      // the intent explicit at upload time, but it's a belt-and-suspenders
      // measure — the actual switch lives in the Cloudinary account's
      // Settings → Security → "Restricted media types", which must have
      // "PDF and ZIP files" unchecked/allowed. See the README's "Cloudinary
      // for persistent file storage" section.
      access_mode: 'public',
    });
    // Local copy was only ever a staging step for the Cloudinary upload —
    // clean it up so it doesn't sit on the (ephemeral anyway) disk.
    fs.unlink(filePath, () => {});
    return result.secure_url;
  }

  return `/uploads/letters/${fileName}`;
}

module.exports = generateAdmissionLetter;
