const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const fns = require('date-fns');
const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fn8k9ep.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJWT=(req,res,next)=>{
    const authHeader = req.headers.authorization;
    if(!authHeader){
      return res.status(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
          return res.status(403).send({messege: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
  try{
      await client.connect((err)=>{
      app.listen(port, () => {
        console.log("Listening at port", port);
      });
    });
      const appointmentCollection = client.db('denturo').collection('appointment');
      const bookingCollection = client.db('denturo').collection('booking');
      const usersCollection = client.db('denturo').collection('users');


      app.get('/appointments',async(req,res)=>{
        const date = req.query.date;
        const query = {};
        const appointments= await appointmentCollection.find(query).toArray();
        const bookingQuery = {appointmentDate: date}
        const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();

        appointments.forEach(appointment=>{
          const appointmentBooked = alreadyBooked.filter(book=>book.treatment === appointment.name);
          const bookedSlots = appointmentBooked.map(book=>book.slot);
          const remainingSlots = appointment.slots.filter(slot=> !bookedSlots.includes(slot));
          appointment.slots = remainingSlots;
        })
        res.send(appointments);
      })

      app.get('/bookings', verifyJWT, async(req,res)=>{
        const email = req.query.email;
        const decodedEmail = req.decoded.email;

        if(email !== decodedEmail){
          return res.status(403).send({message: 'forbidden access'});
        }

        const query = {email : email};
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      })

      app.post('/bookings',async(req,res)=>{
        const booking = req.body;
        // const currentDate = fns.format(new Date(), "PP");
        // const selectedDate = booking.appointmentDate;
        const query = {
          appointmentDate : booking.appointmentDate,
          treatment : booking.treatment,
          email : booking.email
        }
        const alreadyBooked = await bookingCollection.find(query).toArray();
        if(alreadyBooked.length){
          const messege = `You already have an appointment on ${booking.appointmentDate}`
          return res.send({acknowledged : false, messege})
        }
        // if(currentDate>selectedDate){
        //   const messege = `No appointment available on ${booking.appointmentDate}`
        //   return res.send({acknowledged : false, messege})
        // }
        const result= await bookingCollection.insertOne(booking);
        res.send(result);
      })

      app.get('/users',async(req,res)=>{
        const query = {};
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      })

      app.get('/jwt',async(req,res)=>{
          const email = req.query.email;
          const query = {email:email};
          const user = await usersCollection.findOne(query);
          if(user){
            const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'});
            return res.send({accessToken: token});
          }
          res.status(403).send({accessToken:''});
      })

      app.post('/users',async(req,res)=>{
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.send(result);
      })


  }
  finally{

  }

}
run().catch(console.log);


app.get('/', async(req,res)=>{
    res.send("Server is runing")
})
