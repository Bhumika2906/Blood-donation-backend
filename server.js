const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Donor = require("./models/donor");
const app = express();
const Receiver = require("./models/receiver");

app.use(express.json());
app.use(cors({
     origin: [
    'http://localhost:3000',                                      // for local dev
    'https://bloodline-project.vercel.app'
  ],
  credentials: true
}));

mongoose.connect(process.env.MONGODB_URI)
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

const PORT = process.env.PORT || 5000;
app.listen(PORT , () => {
    console.log(`server is running at port: ${PORT}`);
});