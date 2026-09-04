const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiters');

const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/course.routes');
const applicationRoutes = require('./routes/application.routes');
const galleryRoutes = require('./routes/gallery.routes');
const carouselRoutes = require('./routes/carousel.routes');
const settingsRoutes = require('./routes/settings.routes');
const messageRoutes = require('./routes/message.routes');
const testimonialRoutes = require('./routes/testimonial.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const userRoutes = require('./routes/user.routes');
const activityRoutes = require('./routes/activity.routes');

const app = express();

// Behind a proxy (Render/Heroku/Nginx) in production, so secure cookies & rate-limit IPs work
app.set('trust proxy', 1);

// --- Security middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images/videos to be embedded by the Next.js frontend
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . operators from user input to prevent NoSQL injection
app.use(xss()); // sanitizes user input from malicious HTML/JS
app.use(hpp()); // protects against HTTP parameter pollution
app.use('/api', apiLimiter);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static file serving for uploaded images/videos/letters
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/carousel', carouselRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity', activityRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
