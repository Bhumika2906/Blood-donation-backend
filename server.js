require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Donor = require("./models/donor");
const app = express();
const Receiver = require("./models/receiver");
const axios = require('axios');

app.use(express.json());
const allowedOrigins = [
  'http://localhost:3000',
  'https://bloodline-project.vercel.app'
];

app.use(cors({
  origin: allowedOrigins
}));


mongoose.connect(process.env.MONGODB_URI , {
//     useNewUrlParser: true,
//   useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB successfully!')
})
.catch((err) => {
    console.error('MongoDB connection error',err)
});

app.get("/",(req , res) => {
    res.status(200).send("welcome to Blood Donation site");

});

//Get all donors
app.get("/donors", async(req,res) => {
    try {
        const donors = await Donor.find().sort({registrationDate: -1});
        res.json(donors);

    }
    catch(error){
        res.status(500).json({error:error.message });
    }
});

//Add new donor
app.post("/donors", async(req , res) =>{
    try {
    console.log("recieved donor data",req.body);

    const existingDonor = await Donor.findOne({ email: req.body.email });
        if (existingDonor) {
            return res.status(400).json({
                success: false,
                message: "Donor with this email already exists"
            });
        }
    
        let diseasesInput = '';
         if(req.body.diseases) {
            diseasesInput = req.body.diseases.toLowerCase();
         }

         const unfitDiseases = ['hiv/aids' , 'hepatitis' , 'malaria' , 'asthma' , 'tuberculosis' , 'diabetes' , 'cancer' , 'heart diseases' , 'pregnancy'];
         const isUnfit = unfitDiseases.some(disease => diseasesInput.includes(disease));
         req.body.status = isUnfit ? 'unfit' : 'fit';



    const newDonor = new Donor(req.body);
    const savedDonor = await newDonor.save();

    console.log("Donor saved to database:", savedDonor);
    res.status(201).json({
        message: "Donor registered successfully!",
        donor:savedDonor
    });
} catch(error) {
    console.error("error saving donor",error);
    res.status(400).json({error:error.message});
}
   
});

//Delete donor
app.delete("/donors/:id", async (req,res) => {
    try{
        const deleted = await Donor.findByIdAndDelete(req.params.id);
        if(!deleted) 
            return res.status(404).json({message:"donor not found"});
        res.json({message:"Donor deleted successfully"});

    } catch(error) {
        res.status(500).json({error: error.message});
    }
})

//Receiver
app.post('/receivers', async(req,res) => {
    try{
    const receiver = new Receiver(req.body);
    await receiver.save();
    res.status(200).json({message:"Receiver registered successfully"});
}
catch (error){
    console.error("Error saving receiver:",error);
    res.status(500).json({message: "Failed to register receiver"});
}
}
);

app.get('/receivers',async(req,res) => {
   try{
    const receivers = await Receiver.find();
    res.json(receivers);
   }
   catch(error){
    console.error("Error fetching receiver data:",error);
    res.status(500).json({message:"failed to fetch receivers"});
   }
   }
);

app.get('/receivers/match',async(req,res) => {
    const bloodGroup = req.query.bloodGroup.trim();
 console.log("Query received for blood group:", bloodGroup);
    try{
        const donors = await Donor.find({ // here we search in mongoDB for matching donor
            bloodGroup: bloodGroup,
            status: 'fit'
        });

         console.log("Donors found:", donors.length);
        res.json(donors);
    }
    catch (error){
        res.status(500).json({
            message: "failed to fetch donors" , error: error.message
        });
    }
}
);

//card stats
//Total Donors
app.get('/stats/donors', async (req,res) => {
    try {
        const total = await Donor.countDocuments();
        res.json({total});

    }catch (error) {
        res.status(500).json({ message: 'failed to get donor stats'});
    }
});

//Total receiver req
app.get('/stats/receivers', async(req,res) => {
    try {
        const total = await Receiver.countDocuments();
        res.json({total});

    } catch(error) {
        res.status(500).json({ message:'Failed to get receiver stats'});
    }
});

//hospital

const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;


//GET 
app.get('/search', async(req,res) => {
    const{ location } = req.query;

    if(!location) {
        return res.status(400).json({error : 'Location required'});

    }

    try {
        //get coordinates
       const geoUrl = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(location)}&format=json&limit=1`;

        const geoResponse = await axios.get(geoUrl);

        if (!geoResponse.data || !geoResponse.data.length ) {
            return res.status(404).json({error: 'Location not found'});
        }
    
        console.log("locationIQ full response:", geoResponse.data);

    const lat = parseFloat(geoResponse.data[0].lat);
        const lon = parseFloat(geoResponse.data[0].lon);
        
        console.log("Extracted coordinates:", { lat, lon });

    
        const radius = 5000;
        const overpassQuery = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radius},${lat},${lon});way["amenity"="hospital"](around:${radius},${lat},${lon});node["healthcare"="blood_donation"](around:${radius},${lat},${lon}););out center;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    
        const response = await axios.get(url);

        if (!response.data.elements || response.data.elements.length === 0) {
            return res.json([]); // Return empty array if no places found
        }

        const places = response.data.elements.map((element) => {
            let placeLat, placeLon;
            
            // FIXED: Handle different element types from Overpass API
            if (element.type === 'node') {
                placeLat = element.lat;
                placeLon = element.lon;
            } else if (element.center) {
                placeLat = element.center.lat;
                placeLon = element.center.lon;
            } else {
                return null; // Skip if no coordinates
            }
            

            const tags = element.tags || {}; // FIXED: Overpass uses 'tags' not 'properties'

            return {
                name: tags.name || 'Unnamed place',
                description: tags['addr:full'] || 
                           `${tags['addr:street'] || ''} ${tags['addr:city'] || location}`.trim() || 
                           'No address available',
                // FIXED: Determine category from tags
                category: tags.healthcare === 'blood_donation' ? 'healthcare.blood_donation' : 'healthcare.hospital',
                
            };
        }).filter(place => place !== null); // Remove null entries


        const popularHospitals = ['Apollo','Fortis','AIIMS','CityCare','Medanta', 'Max' ,'Artemis', 'Kokilaben']
       
        const bloodBanks = places.filter(p => p.category === 'healthcare.blood_donation');
        
        const hospitalPopular = places.filter(p =>
            p.category === 'healthcare.hospital' &&
            popularHospitals.some(keyword => p.name.toLowerCase().includes(keyword.toLowerCase()))
        );

        const hospitalOthers = places.filter(p =>
           p.category === 'healthcare.hospital' &&
           !popularHospitals.some(keyword => p.name.toLowerCase().includes(keyword.toLowerCase()))
        );

const sortedPlaces = [...bloodBanks, ...hospitalPopular , ...hospitalOthers];

        res.json(sortedPlaces);
    } catch (error) {
        console.error('LocationIQ error:', error.message);
        res.status(500).json({error:'Failed to fetch nearby places'});

    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT , () => {
    console.log(`server is running at port: ${PORT}`);
});