const express = require('express');
const app = express();
const cors = require('cors');
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;

const serviceAccount = require('./docs-app-kb-firebase-adminsdk-p8868-2829ac0e1f.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sydng.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        } catch (error) {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();

        const database = client.db('docsApp');
        const appointmentCollection = database.collection('appointments');
        const userCollection = database.collection('users');

        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();

            const query = { email: email, date: date };
            const cursor = appointmentCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        app.get('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await appointmentCollection.findOne(query);
            res.json(result);
        })

        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = { 
                $set: {
                    payment: payment
                }
            }
            const result = await appointmentCollection.updateOne(filter, updateDoc);
            res.json(result);
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);

            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentCollection.insertOne(appointment);
            res.json(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.json(result);
        })

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.json(result);
        })

        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.fee * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: [
                    'card'
                ]
            });
            res.json({
                clientSecret: paymentIntent.client_secret
            })
        });

    } finally {
        //   await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Docs App is Running...');
})

app.listen(port, () => {
    console.log(`Docs App is listening at ${port}`);
})