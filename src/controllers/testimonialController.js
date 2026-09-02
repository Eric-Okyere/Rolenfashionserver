const Testimonial = require('../models/Testimonial');
const logActivity = require('../utils/activityLog');

async function listTestimonials(req, res) {
  const showAll = req.query.all === '1' && req.user;
  const filter = showAll ? {} : { isPublished: true };
  const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
  res.json({ testimonials });
}

async function createTestimonial(req, res) {
  const testimonial = await Testimonial.create(req.body);
  await logActivity({
    type: 'testimonial.created',
    summary: `${req.user.name} added a testimonial from ${testimonial.name}`,
    meta: { testimonialId: testimonial._id },
    actor: req.user,
  });
  res.status(201).json({ testimonial });
}

async function updateTestimonial(req, res) {
  const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!testimonial) return res.status(404).json({ message: 'Not found.' });
  res.json({ testimonial });
}

async function deleteTestimonial(req, res) {
  await Testimonial.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted.' });
}

module.exports = { listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial };
