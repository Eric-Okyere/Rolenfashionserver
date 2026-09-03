const Course = require('../models/Course');
const logActivity = require('../utils/activityLog');
const { fileUrl } = require('../middleware/upload');

// GET /api/courses (public — published only, unless ?all=1 and authenticated admin)
async function listCourses(req, res) {
  const showAll = req.query.all === '1' && req.user;
  const filter = showAll ? {} : { isPublished: true };
  if (req.query.category) filter.category = req.query.category;
  const courses = await Course.find(filter).sort({ order: 1, createdAt: -1 });
  res.json({ courses });
}

// GET /api/courses/:slug
async function getCourse(req, res) {
  const course = await Course.findOne({ slug: req.params.slug });
  if (!course || (!course.isPublished && !req.user)) {
    return res.status(404).json({ message: 'Course not found.' });
  }
  res.json({ course });
}

// POST /api/courses (admin)
async function createCourse(req, res) {
  const course = await Course.create(req.body);
  await logActivity({
    type: 'course.created',
    summary: `${req.user.name} added a new course: ${course.title}`,
    meta: { courseId: course._id },
    actor: req.user,
  });
  res.status(201).json({ course });
}

// PUT /api/courses/:id (admin)
async function updateCourse(req, res) {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  await logActivity({
    type: 'course.updated',
    summary: `${req.user.name} updated course: ${course.title}`,
    meta: { courseId: course._id },
    actor: req.user,
  });
  res.json({ course });
}

// DELETE /api/courses/:id (admin)
async function deleteCourse(req, res) {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  await logActivity({
    type: 'course.deleted',
    summary: `${req.user.name} deleted course: ${course.title}`,
    actor: req.user,
  });
  res.json({ message: 'Course deleted.' });
}

// POST /api/courses/:id/image (admin) — set cover image after upload middleware
async function setCourseImage(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded.' });
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { image: fileUrl(req.file, 'courses') },
    { new: true }
  );
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  res.json({ course });
}

module.exports = { listCourses, getCourse, createCourse, updateCourse, deleteCourse, setCourseImage };
