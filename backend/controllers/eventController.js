const SchoolEvent = require('../models/SchoolEvent');

// @desc    Get all school events
// @route   GET /api/events
// @access  Private
const getSchoolEvents = async (req, res, next) => {
  try {
    const events = await SchoolEvent.find({}).sort({ date: 1 });
    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create school event
// @route   POST /api/events
// @access  Private/Admin
const createSchoolEvent = async (req, res, next) => {
  try {
    const { title, description, date, type } = req.body;

    if (!title || !description || !date || !type) {
      return res.status(400).json({ success: false, message: 'Please provide title, description, date, and type' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin accounts can publish school events' });
    }

    const event = await SchoolEvent.create({
      title,
      description,
      date,
      type,
    });

    try {
      const { getIo } = require('../services/socketService');
      const io = getIo();
      if (io) io.emit('event_created', event);
    } catch (err) {}

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update school event
// @route   PUT /api/events/:id
// @access  Private/Admin
const updateSchoolEvent = async (req, res, next) => {
  try {
    const { title, description, date, type } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin accounts can edit school events' });
    }

    let event = await SchoolEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    event = await SchoolEvent.findByIdAndUpdate(
      req.params.id,
      { title, description, date, type },
      { new: true, runValidators: true }
    );

    try {
      const { getIo } = require('../services/socketService');
      const io = getIo();
      if (io) io.emit('event_updated', event);
    } catch (err) {}

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete school event
// @route   DELETE /api/events/:id
// @access  Private/Admin
const deleteSchoolEvent = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin accounts can delete school events' });
    }

    const event = await SchoolEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    await SchoolEvent.findByIdAndDelete(req.params.id);

    try {
      const { getIo } = require('../services/socketService');
      const io = getIo();
      if (io) io.emit('event_deleted', { _id: req.params.id });
    } catch (err) {}

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSchoolEvents,
  createSchoolEvent,
  updateSchoolEvent,
  deleteSchoolEvent,
};
