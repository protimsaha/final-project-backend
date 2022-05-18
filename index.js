const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const token = jwt.sign({ foo: 'bar' }, 'shhhhh');
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


var uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0-shard-00-00.j44nf.mongodb.net:27017,cluster0-shard-00-01.j44nf.mongodb.net:27017,cluster0-shard-00-02.j44nf.mongodb.net:27017/myFirstDatabase?ssl=true&replicaSet=atlas-6zy9xf-shard-0&authSource=admin&retryWrites=true&w=majority`;
MongoClient.connect(uri, function (err, client) {

    function verifyJWT(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).send({ message: 'Unauthorized access' })
        }
        const token = authHeader.split(' ')[1]
        jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
            if (err) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            req.decoded = decoded
            next()
        });
    }


    async function run() {
        try {
            await client.connect()
            const serviceCollection = client.db('doctors_portal').collection('services')
            const bookingCollection = client.db('doctors_portal').collection('bookings')
            const userCollection = client.db('doctors_portal').collection('users')
            const doctorCollection = client.db('doctors_portal').collection('doctors')

            app.get('/services', async (req, res) => {
                const query = {}
                const cursor = serviceCollection.find(query).project({ name: 1 })
                const services = await cursor.toArray()
                res.send(services)
            })

            const verifyAdmin = async (req, res, next) => {
                const email = req.params.email
                const requester = req.decoded.email;
                const requesterAccount = await userCollection.findOne({ email: requester })
                if (requesterAccount.role === 'admin') {
                    next()
                }
                else {
                    res.status(403).send({ message: 'Unauthorized request' })
                }
            }

            app.get('/user', verifyJWT, async (req, res) => {
                const users = await userCollection.find().toArray()
                res.send(users)
            })

            app.get('/admin/:email', async (req, res) => {
                const email = req.params.email;
                const user = await userCollection.findOne({ email: email });
                const isAdmin = user.role === 'admin';
                res.send({ admin: isAdmin })
            })

            app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
                const email = req.params.email;
                const filter = { email: email }
                const updateDoc = {
                    $set: { role: 'admin' }
                };
                const result = await userCollection.updateOne(filter, updateDoc)
                res.send(result)

            })
            app.put('/user/:email', async (req, res) => {
                const email = req.params.email
                const user = req.body;
                const filter = { email: email }
                const options = { upsert: true }
                const updateDoc = {
                    $set: user
                };
                const result = await userCollection.updateOne(filter, updateDoc, options)
                const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                res.send({ result, token })
            })


            app.post('/bookings', async (req, res) => {
                const data = req.body
                const query = { treatment: data.treatment, date: data.date, patient: data.patient }
                const exists = await bookingCollection.findOne(query)
                if (exists) {
                    return res.send({ success: false, data: exists })
                }
                const result = await bookingCollection.insertOne(data)
                return res.send({ success: true, result })
            })


            app.get('/bookings', verifyJWT, async (req, res) => {
                const patient = req.query.patient;
                const decodedEmail = req.decoded.email;
                if (patient === decodedEmail) {
                    const query = { patient: patient }
                    const bookings = await bookingCollection.find(query).toArray()
                    return res.send(bookings);
                }
                else {
                    return res.status(403).send('Forbidden access')
                }
            })


            app.get('/available', async (req, res) => {
                const date = req.query.date
                const services = await serviceCollection.find().toArray()

                const query = { date: date }
                const bookings = await bookingCollection.find(query).toArray()

                services.forEach(service => {
                    const serviceBookings = bookings.filter(book => book.treatment === service.name)
                    const bookedSlots = serviceBookings.map(book => book.slot)
                    const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                    service.slots = available
                })
                res.send(services)
            })

            app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
                const doctor = req.body;
                const result = await doctorCollection.insertOne(doctor)
                res.send(result)
            })

            app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
                const doctors = await doctorCollection.find().toArray()
                res.send(doctors)
            })
            app.delete('/doctors/:email', verifyJWT, verifyAdmin, async (req, res) => {
                const email = req.params.email;
                const filter = { email: email }
                const doctors = await doctorCollection.deleteOne(filter)
                res.send(doctors)
            })

        }
        finally {

        }
    }

    run().catch(console.dir)

});



app.get('/', (req, res) => {
    res.send('Doctors server is running')
})

app.listen(port, () => {
    console.log('Listening to port', port)
})