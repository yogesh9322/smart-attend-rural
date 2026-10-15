const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Load env variables
dotenv.config();

// Connect to Database
const dbReady = connectDB();

const app = express();
const http = require('http');
const server = http.createServer(app);
const { initSocket } = require('./services/socketService');
initSocket(server);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Serve uploads folder statically for profile images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure database connection is ready before handling API routes
app.use('/api', async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    next(err);
  }
});

// Routes files
const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const parentRoutes = require('./routes/parentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const aiRoutes = require('./routes/aiRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const eventRoutes = require('./routes/eventRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const searchRoutes = require('./routes/searchRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/events', eventRoutes);

// File Upload endpoint
const upload = require('./middleware/uploadMiddleware');
const { uploadImage } = require('./services/cloudinaryService');
const { protect } = require('./middleware/authMiddleware');

app.post('/api/upload', protect, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }
    const result = await uploadImage(req.file.path);
    res.status(200).json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    next(error);
  }
});
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', searchRoutes);

// Database Seeding Logic (Run on Startup)
const seedDatabase = async () => {
  try {
    const User = require('./models/User');
    const Class = require('./models/Class');
    const Student = require('./models/Student');
    const Notice = require('./models/Notice');

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Database is empty. Seeding demo accounts...');

      // 1. Seed admin
      const admin = await User.create({
        name: 'Principal Sharma',
        email: 'admin@school.com',
        password: 'password123',
        role: 'admin',
        phone: '9876543210',
      });

      // 2. Seed teacher
      const teacher = await User.create({
        name: 'Ramesh Kumar',
        email: 'ysp932215@gmail.com',
        password: 'password123',
        role: 'teacher',
        phone: '8765432109',
        phoneNumber: '8765432109',
        countryCode: '+91',
        whatsappEnabled: true,
      });

      // 3. Seed parent
      const parent = await User.create({
        name: 'Suresh Patel',
        email: 'parent@school.com',
        password: 'password123',
        role: 'parent',
        phone: '7654321098',
      });

      console.log('Demo Users Seeded:');
      console.log('- Admin: admin@school.com / password123');
      console.log('- Teacher: teacher@school.com / password123');
      console.log('- Parent: parent@school.com / password123');

      // 4. Seed a class
      const class6A = await Class.create({
        grade: 'Grade 6',
        section: 'A',
        classTeacherId: teacher._id,
        roomNo: 'Room 102',
        academicYear: '2026-2027',
      });
      console.log('Demo Class Seeded: Grade 6-A');

      // Add class to teacher
      teacher.assignedClasses.push(class6A._id);
      await teacher.save();

      // 5. Seed students
      const student1 = await Student.create({
        name: 'Aarav Patel',
        rollNo: '01',
        admissionNo: 'ADM202601',
        classId: class6A._id,
        parentId: parent._id,
        gender: 'Male',
        dob: new Date('2015-05-12'),
      });

      const student2 = await Student.create({
        name: 'Diya Patel',
        rollNo: '02',
        admissionNo: 'ADM202602',
        classId: class6A._id,
        parentId: parent._id,
        gender: 'Female',
        dob: new Date('2015-09-18'),
      });
      console.log('Demo Students Seeded: Aarav Patel (Roll 01), Diya Patel (Roll 02)');

      // Link children to parent
      parent.children.push(student1._id, student2._id);
      await parent.save();

      // 6. Seed notice
      await Notice.create({
        title: 'Mid-Term Examinations Schedule',
        content: 'Dear Teachers and Parents, please take notice that the Mid-term examinations will commence from September 10th. Timetables have been posted in the main office.',
        targetAudience: 'all',
        createdBy: admin._id,
        isPinned: true,
      });
      console.log('Demo Notice Seeded');

      // 7. Seed School Events Calendar
      const SchoolEvent = require('./models/SchoolEvent');
      await SchoolEvent.create([
        {
          title: 'Sports Day & Athletics Meet',
          description: 'Annual inter-school athletic tournaments and track races.',
          date: new Date('2026-10-15'),
          type: 'Event',
        },
        {
          title: 'Mid-Term Examinations Commences',
          description: 'Academic mid-term evaluations for Grade 1 through 10.',
          date: new Date('2026-09-10'),
          type: 'Exam',
        },
        {
          title: 'Parent-Teacher Council Session',
          description: 'General assembly for parents to review academic roster cards.',
          date: new Date('2026-08-05'),
          type: 'Meeting',
        },
        {
          title: 'National Holiday (Independence Day)',
          description: 'School flag hoisting and cultural programs.',
          date: new Date('2026-08-15'),
          type: 'Holiday',
        }
      ]);
      console.log('Demo School Events Seeded');
    }

    // Always ensure teacher email and whatsapp configurations are updated
    await User.updateOne(
      { role: 'teacher' },
      { 
        email: 'ysp932215@gmail.com',
        phoneNumber: '8765432109',
        countryCode: '+91',
        whatsappEnabled: true,
      }
    );

    // Clean up any historical misassigned Grade 6-A records for Sakshi (who belongs to Grade 10-B)
    const Attendance = require('./models/Attendance');
    const sakshi = await Student.findOne({ name: { $regex: /sakshi/i } });
    const class6A = await Class.findOne({ grade: 'Grade 6', section: 'A' });
    if (sakshi && class6A) {
      await Attendance.deleteMany({ studentId: sakshi._id, classId: class6A._id });
      console.log('Cleaned up misassigned Grade 6-A attendance records for Sakshi.');
    }
    console.log('Demo Teacher email and WhatsApp fields updated in DB.');
  } catch (error) {
    console.error('Seeding database failed:', error.message);
  }
};

// Call Seeder after DB connection is established
dbReady.then(() => seedDatabase());

// Test API Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'SmartAttend API is healthy and active.' });
});

// Error handling middleware (must be mounted last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in development mode on port ${PORT} (Bound to 0.0.0.0)`);
});

// Trigger nodemon env reload after manual edits to .env file.
// Reloading for updated Google OAuth Client ID
