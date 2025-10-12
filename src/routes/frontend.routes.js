import { getDashboard } from "../services/dashboard.service.js";

export default function frontendRoutes(fastify) {
    fastify.get("/dashboard", async (req, reply) => {
        const pagePath = "../views/pages/dashboard.ejs"
        // const data = (await getDashboard())  
        const body = await fastify.view(pagePath, {
            data: {
                "admins": [

                ],
                "users": [
                    {
                        "id": "0CAKMjzkv1P0zZS6ImYh6sAkFMn1",
                        "username": "User",
                        "mobile": "1234525896",
                        "email": "1234525896@sara777.com",
                        "date": "2025-10-08",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "nQ31DWhEXnfgWeerscPv7bkM3Hk2",
                        "username": "User",
                        "mobile": "9887406313",
                        "email": "9887406313@sara777.com",
                        "date": "2025-10-08",
                        "balance": 5560,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "eeFJb2v8FdeYV5brb96MoouB0Jt1",
                        "username": "User",
                        "mobile": "9799289697",
                        "email": "9799289697@sara777.com",
                        "date": "2025-10-05",
                        "balance": 10000,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "Zwvb2c3BSqVDtq0AkgpzNUCHSP13",
                        "username": "User",
                        "mobile": "9509844282",
                        "email": "9509844282@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "XPEs0TQZIXR3HjSpBNhaz5AgrCN2",
                        "username": "User",
                        "mobile": "1111111111",
                        "email": "1111111111@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "AZTFaHvWJibhsyOhCgj5EqFs0Xa2",
                        "username": "User",
                        "mobile": "1472583690",
                        "email": "1472583690@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "Ec5A0tFFVEZ8wekoX07zQYJcL6L2",
                        "username": "User",
                        "mobile": "8000104633",
                        "email": "8000104633@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "nYO0bcJ1lUYYeXQK62hw2IPdg3C2",
                        "username": "User",
                        "mobile": "1212121212",
                        "email": "1212121212@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "uQOD61vUuFYri17cNIpheTYDxXi2",
                        "username": "User",
                        "mobile": "1472580147",
                        "email": "1472580147@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "Tj7AZquCmdhda483gmcSZLn1MKv1",
                        "username": "User",
                        "mobile": "9998887770",
                        "email": "9998887770@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "XM1edZcanpTYUgtDqRJfnnYoImp2",
                        "username": "User",
                        "mobile": "1241241242",
                        "email": "1241241242@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "g6xEvxeVxDYnsVVUzUv2yQyr3AJ2",
                        "username": "User",
                        "mobile": "1122334455",
                        "email": "1122334455@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "aPHqqkdz8gcp4ri6PfcqcNx4SD42",
                        "username": "User",
                        "mobile": "2548376950",
                        "email": "2548376950@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "4T1Husy8jmXGLEEGS8HEgEbWxRu2",
                        "username": "User",
                        "mobile": "4564564560",
                        "email": "4564564560@sara777.com",
                        "date": "2025-10-04",
                        "balance": 820,
                        "betting": true,
                        "transfer": false
                    },
                    {
                        "id": "o6JX7m7fNsMLLipORiQHNk7wNYg2",
                        "username": "User",
                        "mobile": "9887406314",
                        "email": "9887406314@sara777.com",
                        "date": "2025-10-04",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "QT2E1XXZuIhpmBO9prDln4UT1cx1",
                        "username": "User",
                        "mobile": "8804051940",
                        "email": "8804051940@sara777.com",
                        "date": "2025-10-03",
                        "balance": 400,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "qtD3GxUkpJd11MFDVvNbQD5mmeb2",
                        "username": "User",
                        "mobile": "7374955153",
                        "email": "7374955153@sara777.com",
                        "date": "2025-10-03",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "EdA4nxW2pfMQV23CyZYO3magKI12",
                        "username": "User",
                        "mobile": "9879879870",
                        "email": "9879879870@sara777.com",
                        "date": "2025-10-03",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "XPpSu46qToUzNzPNy0K5UJj6UD22",
                        "username": "User",
                        "mobile": "2546789021",
                        "email": "2546789021@sara777.com",
                        "date": "2025-10-03",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    },
                    {
                        "id": "4s5jp8T2B8ca1rueZbOrMcAxGCO2",
                        "username": "User",
                        "mobile": "9876451323",
                        "email": "9876451323@sara777.com",
                        "date": "2025-10-03",
                        "balance": 0,
                        "betting": false,
                        "transfer": false
                    }
                ],
                "stats": {
                    "totalBiddingAmount": 5060,
                    "totalWinningAmount": 0,
                    "totalLostAmount": 4780,
                    "totalSubmissions": 11,
                    "newUsersCount": 0
                },
                "ank": {
                    "SHRI DAY": {
                        "2": {
                            "amount": 20,
                            "bidsCount": 1
                        },
                        "6": {
                            "amount": 20,
                            "bidsCount": 1
                        },
                        "8": {
                            "amount": 20,
                            "bidsCount": 1
                        }
                    },
                    "KALYAN BAZAR": {
                        "5": {
                            "amount": 700,
                            "bidsCount": 2
                        }
                    }
                },
                "market_detail": {
                    "SHRI DAY": {
                        "amount": 60,
                        "bidsCount": 3
                    },
                    "TIME BAZAR": {
                        "amount": 4000,
                        "bidsCount": 2
                    },
                    "KALYAN BAZAR": {
                        "amount": 700,
                        "bidsCount": 2
                    },
                    "KING NIGHT": {
                        "amount": 180,
                        "bidsCount": 1
                    },
                    "ALISHAN DAY": {
                        "amount": 20,
                        "bidsCount": 1
                    },
                    "KARNATAKA NIGHT": {
                        "amount": 60,
                        "bidsCount": 1
                    },
                    "KALYAN": {
                        "amount": 40,
                        "bidsCount": 1
                    }
                },
                "totalCompleted": 0,
                "totalDeclined": 3200
            }
        });

        return reply.view("layout.ejs", { title: "Dashboard", body });
    });

}