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

    async function run() {
        try {
            await client.connect()
            const serviceCollection = client.db('doctors_portal').collection('services')
            const bookingCollection = client.db('doctors_portal').collection('bookings')
            const userCollection = client.db('doctors_portal').collection('users')

            app.get('/services', async (req, res) => {
                const query = {}
                const cursor = serviceCollection.find(query)
                const services = await cursor.toArray()
                res.send(services)
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


            app.get('/bookings', async (req, res) => {
                const patient = req.query.patient;
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray()
                res.send(bookings)
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