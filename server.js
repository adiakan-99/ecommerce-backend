const Express = require("express")
const CORS = require("cors")
const Mongoose = require("mongoose")
const BCrypt = require("bcrypt")
const Razorpay = require("razorpay")
const JWT = require("jsonwebtoken");
const CookieParser = require("cookie-parser");

const app = Express()

app.use(Express.json())
app.use(CORS());
app.use(CookieParser())

Mongoose.connect("mongodb+srv://aditya:ecommerce@cluster0.itjfpg5.mongodb.net/ecommercedatabse?retryWrites=true&w=majority&appName=Cluster0")

const SECRET_KEY = "adityaecommerce";

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ "message": "Unauthorized access!" });
    }

    const token = authHeader.split(' ')[1];

    JWT.verify(token, SECRET_KEY, (error) => {
        if (error) {
            return res.status(403).json({ "message": "Unauthorized access!" });
        }
        next();
    })
}

const AddressSchema = new Mongoose.Schema({
    phonenumber: {
        type: String,
        required: true
    },
    addressline: {
        type: String,
        required: true
    },
    pincode: {
        type: Number,
        required: true,
        validate: {
            validator: function (v) {
                return /^\d{6}$/.test(v.toString());
            },
            message: props => `${props.value} is not a valid pincode! It should be a 6-digit number.`
        }
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    }
});

const UserSchema = new Mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username required!"],
        unique: [true, "Username already used!"]
    },
    email: {
        type: String,
        required: [true, "Email required!"],
        unique: [true, "Email already exists!"]
    },
    password: {
        type: String,
        required: [true, "Please enter a password"]
    },
    addresses: {
        type: [AddressSchema]
    }
});

const UserModel = Mongoose.model("users", UserSchema)

app.post("/signup", async (req, res) => {
    const { username, email, password, confirmPassword } = req.body

    // Validate required fields
    if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({ "message": "All fields are required!" });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).json({ "message": "Passwords don't match" });
    }

    try {
        // Hash the password
        const hashedPassword = await BCrypt.hash(password, 15);

        // Create new user
        const user = new UserModel({
            username,
            email,
            password: hashedPassword
        });

        // Save the user to the database
        await user.save();

        return res.status(201).json({ "message": "Sign Up successful!" });

    } catch (error) {
        console.log(error);

        if (error.name === 'ValidationError') {
            // Handle validation errors from Mongoose
            return res.status(400).json({ "message": error.message });
        }

        if (error.code === 11000) {
            // Handle duplicate key errors
            return res.status(400).json({ "message": "Username or Email already exists!" });
        }

        // Handle other errors
        return res.status(500).json({ "message": "Sign Up Error!" });
    }
});

app.post("/signin", async (req, res) => {
    const { email, password } = req.body

    try {
        // Check if user exists
        const UserData = await UserModel.findOne({ email })

        if (UserData) {
            // Check if passwword is correct
            const isPasswordCorrect = await BCrypt.compare(password, UserData.password)

            if (isPasswordCorrect) {
                const generatedToken = JWT.sign({
                    id: UserData._id,
                    email: UserData.email
                }, SECRET_KEY);

                return res.json({ "message": "Signin succesfull!", username: UserData.username, email: UserData.email, token: generatedToken });
            } else {
                console.log("Incorrect Password!")
                return res.json({ "message": "Incorrect Password!" })
            }
        } else {
            console.log("Incorrect email!")
            return res.json({ "message": "Email does not exist!" })
        }
    }
    catch (error) {
        console.log(error)
        return res.json({ "message": "There was an error during sign in!" })
    }
})

app.patch("/change/user/email/:username", authenticateJWT, async (req, res) => {
    const { username } = req.params;
    const { email, password } = req.body;

    try {
        const UserData = await UserModel.findOne({ username });

        if (UserData) {
            const isPasswordCorrect = await BCrypt.compare(password, UserData.password);

            console.log(isPasswordCorrect);

            if (isPasswordCorrect) {
                UserData.email = email;

                UserData.save();

                console.log("Your email has been updated successfully!");
                return res.json({ "message": "Your email has been updated successfully!" });
            } else {
                console.log("Incorrect Password!")
                return res.json({ "message": "Incorrect Password!" });
            }
        } else {
            return res.json({ "message": "Incorrect username!" });
        }
    }
    catch (error) {
        console.log(error);
        return res.json({ "message": "There was an error when updating your email!" });
    }
})

app.patch("/change/user/password", authenticateJWT, async (req, res) => {
    const { email, currentPassword, newPassword, confirmNewPassword } = req.body;

    try {
        const UserData = await UserModel.findOne({ email });

        if (UserData) {
            const isCurrentPassswordCorrect = await BCrypt.compare(currentPassword, UserData.password);

            console.log(isCurrentPassswordCorrect);

            if (isCurrentPassswordCorrect) {
                if (newPassword === confirmNewPassword) {
                    const hashedPassword = await BCrypt.hash(newPassword, 15);

                    UserData.password = hashedPassword;

                    UserData.save();

                    console.log("Password updated succesfully!");
                    return res.json({ "message": "Password updated succesfully!" });
                } else {
                    console.log("Passwords don't match!");
                    return res.json({ "message": "Passwords don't match!" })
                }
            } else {
                console.log("Invalid current password!");
                return res.json({ "message": "Invalid current password!" });
            }
        } else {
            console.log("Invalid email!");
            return res.json({ "message": "Invalid email!" });
        }
    }
    catch (error) {
        console.log(error);
        return res.json({ "message": "There was an error while changing the password!" })
    }
})

const ProductSchema = new Mongoose.Schema({
    id: Number,
    title: String,
    price: Number,
    description: String,
    category: String,
    image: String,
    rating: {
        rate: Number,
        count: Number
    }
})

const WishlistSchema = new Mongoose.Schema({
    userID: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "users",
        unique: true,
        required: true
    },
    products: {
        type: [ProductSchema]
    }
})

const WishlistModel = Mongoose.model("userwishlists", WishlistSchema)

app.post("/add/wishlist", async (req, res) => {
    const { product, username } = req.body

    try {
        const userData = await UserModel.findOne({ username });

        // console.log(userData)

        const userID = userData._id;

        // console.log(userID)

        const UserWishlist = await WishlistModel.findOne({ userID })

        // console.log(UserWishlist)

        if (!UserWishlist) {
            // console.log("Hello")

            const Wishlist = new WishlistModel({
                userID: userID,
                products: [product]
            })

            Wishlist.save()

            // console.log(Wishlist)
        } else {
            if (!UserWishlist.products.some((i) => i.id === product.id)) {
                UserWishlist.products.push(product)
                UserWishlist.save()
            }

            // console.log(UserWishlist)
        }

        return res.json({ "message": "Wishlist updated succesfully!" })
    }
    catch (error) {
        return res.json({ "message": "There was an error when adding the product!" })
    }
});

app.get("/view/wishlist", async (req, res) => {
    const { username } = req.query

    try {
        const UserData = await UserModel.findOne({ username })

        const userID = UserData._id;

        const UserWishlist = await WishlistModel.findOne({ userID })

        if (UserWishlist) {
            return res.json({ "message": "Here's your wishlist", "products": UserWishlist.products })
        } else {
            return res.json({ "message": "Your wishlist is empty!" })
        }
    }
    catch (error) {
        return res.json({ "message": "There was an error when getting your wishlist!" })
    }
});

app.delete("/remove/wishlist/:username/:productID", async (req, res) => {
    const { productID, username } = req.params

    try {
        const UserData = await UserModel.findOne({ username });

        const userID = UserData._id;

        const UserWishlist = await WishlistModel.findOne({ userID })

        if (UserWishlist) {
            const filteredProducts = UserWishlist.products.filter((product) => product.id != productID)

            UserWishlist.products = filteredProducts

            await UserWishlist.save()

            return res.json({ "message": "The requested product has been deleted from user's wishlist!" })
        } else {
            return res.json({ "message": "User's wishlist not found!" })
        }
    }
    catch (error) {
        return res.json({ "message": "There was an error when trying to delete th product from user's wishlist" })
    }
});

app.post("/add/address", authenticateJWT, async (req, res) => {
    const { username, addressLine, pincode, city, state, phoneNumber } = req.body;

    try {
        const UserData = await UserModel.findOne({ username });

        UserData.addresses.push({
            phonenumber: phoneNumber,
            addressline: addressLine,
            pincode,
            city,
            state
        })

        UserData.save()
        return res.json({ "message": "Address added to user data successfully!" })
    }
    catch (error) {
        console.log(error);
        return res.json({ "message": "There has been an error when adding the address!" })
    }
})

app.patch("/edit/user/address/:username", authenticateJWT, async (req, res) => {
    const { addressID, addressLine, phoneNumber, city, state, pincode } = req.body;
    const { username } = req.params;

    try {
        const UserData = await UserModel.findOne({ username });

        const updatedAddresses = UserData.addresses.map((address) => {
            if (address._id.toString() === addressID.toString()) {
                return {
                    ...address.toObject(),
                    addressline: addressLine,
                    phonenumber: phoneNumber,
                    city,
                    state,
                    pincode
                };
            }

            return address;
        });

        UserData.addresses = updatedAddresses;

        await UserData.save();
        return res.json({ "message": "Address updated successfully!" })
    }
    catch (error) {
        console.log(error);
        return res.json({ "message": "There was an error when updating your data!" })
    }
})

app.get("/get/user/addresses", authenticateJWT, async (req, res) => {
    const { username } = req.query;

    try {
        const UserData = await UserModel.findOne({ username });

        const UserAddresses = UserData.addresses;

        return res.json({ "message": "Your saved adddresses", "addresses": UserAddresses });
    }
    catch (error) {
        console.log(error);
        res.json({ "message": "There was an error while getting your addresses!" })
    }
})

app.delete("/delete/user/address/:addressID", authenticateJWT, async (req, res) => {
    const { username } = req.query;
    const { addressID } = req.params;

    try {
        const UserData = await UserModel.findOne({ username });

        const updatedAddresses = UserData.addresses.filter((address) => address._id != addressID);

        UserData.addresses = updatedAddresses;

        UserData.save();

        return res.json({ "message": "The address was succesfully deleted!" })
    }
    catch (error) {
        console.log(error);
        return res.json({ "message": "There was an error when deleting your address!" })
    }
})

const razorpayDetails = new Razorpay({
    key_id: "rzp_test_tQU9lVNtUvQtjs",
    key_secret: "yPGvTGqcznK4jZHROKqMcx1O"
})

app.post("/create/order", authenticateJWT, (req, res) => {
    const enteredAmount = req.body.amount;

    const options = {
        amount: enteredAmount * 100,
        currency: "INR"
    };

    razorpayDetails.orders.create(options, (error, orderInfo) => {
        if (!error) {
            return res.json({ output: orderInfo })
        } else {
            console.log(error)
        }
    })
})

const ProductSchema2 = new Mongoose.Schema({
    id: Number,
    title: String,
    image: String,
    quantity: Number,
    totalPrice: Number
});

const OrderHistorySchema = new Mongoose.Schema({
    user: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    products: [ProductSchema2],
    totalAmount: Number,
    orderPlacedDate: String,
    expectedDeliveryDate: String,
    orderID: String,
    paymentID: String,
    address: AddressSchema
});

const OrderHistoryModel = new Mongoose.model("orderhistory", OrderHistorySchema);

app.post("/insert/order", authenticateJWT, async (req, res) => {
    const { username, amount, order_id, payment_id, products, address } = req.body

    try {
        const UserData = await UserModel.findOne({ username })

        const orderPlacedDate = new Date();
        const expectedDeliveryDate = new Date(orderPlacedDate);
        expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7);

        const order = new OrderHistoryModel({
            user: UserData._id,
            products,
            totalAmount: amount,
            orderPlacedDate,
            expectedDeliveryDate,
            orderID: order_id,
            paymentID: payment_id,
            address
        })

        order.save();

        res.json({ "message": "Your order was successfully placed!" });
    }
    catch (error) {
        console.log(error)
        res.json({ "message": "There was an error when placing your order" });
    }
})

app.get("/get/orders/:username", authenticateJWT, async (req, res) => {
    const username = req.params.username;

    try {
        const userData = await UserModel.findOne({ username });

        const userID = userData._id;

        const orderHistory = await OrderHistoryModel.find({
            user: userID
        });

        orderHistory.sort((a, b) => new Date(b.orderPlacedDate).getTime() - new Date(a.orderPlacedDate).getTime());

        return res.json({ "message": "Your order history", "orderHistory": orderHistory });
    }
    catch (error) {
        console.log(error);
        return res.json({ "message": "There was an error when retrieving your order history" })
    }
});

app.delete("/delete/order/:orderID", authenticateJWT, async (req, res) => {
    const { orderID } = req.params

    try {
        const order = await OrderHistoryModel.findOneAndDelete({ orderID })

        return res.json({ "message": "Order Deleted!" })
    }
    catch (error) {
        console.log(error);
        return res.json({ "message": "There was an error in deleting your data!" })
    }
})

app.listen(9000, () => {
    console.log("Express server is running on port 9000!")
})