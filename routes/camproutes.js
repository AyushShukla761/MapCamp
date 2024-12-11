const express = require('express')
const router = express.Router()
const Campground = require('../models/campground')
const ExpressError = require('../utilities/expressError')
const errhandler = require('../utilities/errhandler')
const Joi = require('joi');
const flash = require('connect-flash')
const islogged = require('../utilities/checklogin')
const isauthor = require('../middleware/authorisation')
const axios = require('axios')
const nominatimEndpoint = 'https://nominatim.openstreetmap.org/search';
const upload = require('../cloudinaryconfig');

// joi schema
const Campschema = require('../utilities/schemaerr')
const { ca } = require('@mapbox/mapbox-gl-geocoder/lib/exceptions')


router.get('/', errhandler(async (req, res) => {
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', { campgrounds })
}))

router.get('/new', islogged, (req, res) => {
    res.render('campgrounds/new');
})

router.post('/', islogged, upload.single('campground[image]'), errhandler(async (req, res) => {
    if (!req.file) {
        throw new ExpressError('No image file uploaded', 400);  // If req.file is still undefined, show an error
    }
    let camp = req.body
    placename = camp.campground.location;
    const { error } = Campschema.validate(camp)
    if (error) {
        const msg = error.error
        
        throw new ExpressError(msg, 404)
        
    }
    const params = {
        q: placename,
        format: 'json',
        limit: 1,
    };
    const response = await axios.get(nominatimEndpoint, { params })
    const campground = new Campground(req.body.campground);
    campground.creator = req.user._id;
    const geometry = { type: "Point", coordinates: [parseFloat(response.data[0].lat), parseFloat(response.data[0].lon)] }
    campground.geometry = geometry;
    campground.image = req.file.path

    await campground.save();
    await req.flash('success', 'Successfully made a new campground!');

    res.redirect(`/campgrounds/${campground._id}`)
}))

router.get('/:id', errhandler(async (req, res,) => {
    const campground = await Campground.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'user',
        }
    }).populate('creator').populate('geometry')
    res.render('campgrounds/show', { campground });
}));

router.get('/:id/edit', islogged, errhandler(async (req, res) => {
    const campground = await Campground.findById(req.params.id)
    res.render('campgrounds/edit', { campground });
}))


router.put('/:id', islogged, isauthor,upload.single('campground[image]'), errhandler(async (req, res) => {
    const { id } = req.params;
    const camp=req.body.campground
    camp.image=req.file.path
    const campground = await Campground.findByIdAndUpdate(id, camp);

    await req.flash('success', 'Successfully updated your campground!');
    
    res.redirect(`/campgrounds/${campground._id}`)
}));

router.delete('/:id', islogged, isauthor, errhandler(async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    await req.flash('success', 'Successfully deleted your campground!');
    res.redirect('/campgrounds');
}))


module.exports = router;