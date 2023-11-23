const express = require('express')
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require("stripe")(process.env.SECRET_KEY)
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
// middleware
app.use(cors())
app.use(express.json())


// jwt varification
const varifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'You are not authorized' })
    }
    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'You are not authorized' })
        }
        req.decoded = decoded;
        next()
    })
}





// mongo setup


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2utjecm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const classCollection = client.db('language-camp').collection('classes')
        const selectedClasses = client.db('language-camp').collection('selected-classes')
        const userCollection = client.db('language-camp').collection('users')
        const paymentCollection = client.db('language-camp').collection('payments')
        const enrolledCollection = client.db('language-camp').collection('enrolled-classes')


        // jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' })
            res.send({ token })
        })


        // post selected class
        app.post('/selectedClasses', varifyJWT, async (req, res) => {
            const newClass = req.body;
            const result = await selectedClasses.insertOne(newClass)
            res.send(result)
        })

        // get selected classes
        app.get('/selectedClasses', varifyJWT, async (req, res) => {
            const email = req.query.email;
            // console.log(email)
            if (!email) {
                res.send([])
            }
            else {
                const decodedEmail = req.decoded.email;
                if (email !== decodedEmail) {
                    return res.status(401).send({ error: true, message: 'Forbidden access' })
                }
                // console.log('decoded',decodedEmail)
                const query = { email: email }
                const result = await selectedClasses.find(query).toArray();
                res.send(result)

            }

        })
        // instructor dashboard

        app.get('/users/instructor/:email', varifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.send({ instructor: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const result = { isInstructor: user?.role === 'instructor' }
            res.send(result)
        })
        // admin dashboard
        app.get('/users/admin/:email', varifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.send({ isAdmin: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const result = { isAdmin: user?.role === 'admin' }
            res.send(result)
        })


        // delete selected classes
        app.delete('/selectedClasses/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedClasses.deleteOne(query)
            res.send(result)
        })

        /*/ -----------------users management------------------/*/


        app.get('/manageUsers', varifyJWT, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.put('/manageUsers/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const role = req.body.role;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { role: role }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })



        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })


        // get all classes approved only
        app.get('/classes', async (req, res) => {
            const query = { status: 'approved' }
            const result = await classCollection.find(query).toArray()
            res.send(result)
        })
        // get all classes for admin management
        app.get('/allClasses', async (req, res) => {
            // const query = {status:'pending'}
            const result = await classCollection.find().toArray()
            res.send(result)
        })
        // update status
        app.put('/updateStatus/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const status = req.body.status
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { status: status }
            }
            const result = await classCollection.updateOne(filter, updateDoc)
            res.send(result)

        })

        // send feedback

        app.put('/sendFeedback/:id', async (req, res) => {
            const id = req.params.id;
            const feedback = req.body.feedback;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { feedback: feedback }
            }
            const result = await classCollection.updateOne(filter, updateDoc)
            // console.log(result)
            res.send(result)
        })
        // get classes by instructor
        app.get('/myClasses/:email', varifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { instructorEmail: email }
            const result = await classCollection.find(query).toArray()
            res.send(result)
        })
        // post class from instructor
        app.post('/addAClass', varifyJWT, async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass)
            res.send(result)
        })
        // update a class
        app.put('/updateAClass/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const updatedClass = req.body;

            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: { updatedClass }
            }
            const result = await classCollection.updateOne(filter, updateDoc, options)
            res.send(result)
            console.log(filter, updateDoc, id)

        })
        // get all instructors
        app.get('/instructors', async (req, res) => {
            const result = await userCollection.find().toArray()
            const instructors = result.filter(instructor=>instructor.role === "instructor")
            console.log(instructors)
            res.send(result)
        })
    



        // payment
        app.post("/create-payment-intent", varifyJWT, async (req, res) => {
            const price = req.body.price;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: price * 100,
                currency: "usd",
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });

        });

        // update seats
        app.patch('/updateAvailableSeats/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const updatedSeats = req.body.updatedSeats
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { seats: updatedSeats }
            };
            const result = await classCollection.updateOne(filter, updateDoc)
            // console.log(updatedSeats)
            res.send(result)
        })


        app.patch('/updateSelectedClasses/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const updatedSeats = req.body.updatedSeats
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { seats: updatedSeats }
            };
            const result = await selectedClasses.updateOne(filter, updateDoc)
            res.send(result)
        })

        // delete form selected item when payment is done
        app.delete('/deleteSelectedClass/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedClasses.deleteOne(query)
            res.send(result)

        })


        // add to enrolledClasses in database
        app.post('/enrolledClasses', async (req, res) => {
            const body = req.body.enrolledItem;
            const result = await enrolledCollection.insertOne(body)
            res.send(result)
        })

        // get  enrolledClasses from database
        app.get('/enrolledClasses/:email', varifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await enrolledCollection.find(query).toArray()
            res.send(result)
        })



        // get all enrolled classes
        app.get('/enrolledClasses', async (req, res) => {
            const result = await enrolledCollection.find().toArray()
            res.send(result)
        })






        // payment management
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment)
            res.send(result)
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('running')
})
app.listen(port, () => {
    console.log(`running on port`, port)
})