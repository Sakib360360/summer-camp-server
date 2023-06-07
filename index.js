const express = require('express')
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
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
        await client.connect();
        const classCollection = client.db('language-camp').collection('classes')
        const instructorCollection = client.db('language-camp').collection('instructors')
        const selectedClasses = client.db('language-camp').collection('selected-classes')
        const userCollection = client.db('language-camp').collection('users')


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
            console.log(email)
            if (!email) {
                res.send([])
            }
            else {
                const decodedEmail = req.decoded.email;
                if (email !== decodedEmail) {
                    return res.status(401).send({ error: true, message: 'Forbidden access' })
                }
                console.log('decoded',decodedEmail)
                const query = { email: email }
                const result = await selectedClasses.find(query).toArray();
                res.send(result)

            }

        })

        // delete selected classes
        app.delete('/selectedClasses/:id', varifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedClasses.deleteOne(query)
            res.send(result)
        })

        /*/ -----------------users management------------------/*/

        app.post('/users', async (req, res) => {
            const users = req.body;
            const result = await userCollection.insertOne(users)
            res.send(result)
        })

        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })


        // get all classes
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray()
            res.send(result)
        })
        // get all instructors
        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().toArray()
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