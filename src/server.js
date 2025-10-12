import app from "./app.js"

const PORT = 3000

app.get('/', (req, res) => {
    res.send({message: "Hello World"})
})


app.listen({port: PORT, host: '0.0.0.0'}).then(() => console.log(`Server running at http://localhost:${PORT}`)).catch(err => {
    console.error(err)
    process.exit(1)

}) 