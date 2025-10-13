import app from "./app.js"
import { MatkaService } from "./services/matka.service.js"

const PORT = 3000

app.get('/', async (req, res) => {
    const data =  await (new MatkaService()).getResults()
        res.send({ message: "Hello World", data })
})


app.listen({ port: PORT, host: '0.0.0.0' }).then(() => console.log(`Server running at http://localhost:${PORT}`)).catch(err => {
    console.error(err)
    process.exit(1)

}) 