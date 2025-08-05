require('dotenv').config();
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Payment = require("../models/Payment");
const User = require("../models/User");
const moment = require("moment");

//setup transporter
const transporter = nodemailer.createTransport({
    service:"gmail",
    auth :{
        user: process.env.EMAIL_USER, //email
        pass: process.env.EMAIL_PASS  //app password

    }
});

//HTML email template 
const buildEmail = (userName , payment , statusText) => {
    return `
    <h3>Hello ${userName},</h3>
    <p>This is a ${statusText} reminder for your payment:</p>
    <ul>
    <li><strong>Name:</strong> ${payment.paymentName}</li>
    <li><strong>Amount:</strong> ${payment.amount}</li>
    <li><strong>Category:</strong> ${payment.category}</li>
    <li><strong>Deadline:</strong> ${moment(payment.deadline).format("DD MMM YYYY")}</li>
    <li><strong>Status:</strong> ${statusText}</li>
</ul>
<a href="${process.env.FRONTEND_URL}/dashboard" style="padding: 10px 15px; background: #007bff; color: white; text-decoration: none;">Manage Payment</a>
    <p>Regards,<br/>Payment Reminder System</p>
    `;
};



const checkPayments = async () => {
    try {
        let emailsSent = 0;
        let emailsFailed = 0;
        
        const now = moment();
        
        const allPayments = await Payment.find({ status: { $ne : "paid"}}).populate("userId");

        for(const payment of allPayments) {
            const deadline = moment(payment.deadline).startOf("day");
            const user = payment.userId;
            const today = now.clone().startOf("day");

            const daysDiff = deadline.diff(today,'days');

            if(!user || !user.email ) continue;

            let send = false ;
            let statusText ="";

            if(daysDiff === 2){
                send = true;
                statusText ="2-day upcoming";
            }
            else if(daysDiff === 1){
                send = true;
                statusText ="1-day upcoming";    

            } else if(daysDiff === 0) {
                send = true;
                statusText = "deadline day";

            } else if(daysDiff < 0) {
                send = true ;
                statusText ="missed  (overdue)";
            }

            if(send) {
                const mailOptions ={
                    from: `"Payment Reminder System" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: `Payment ${statusText} Reminder: ${payment.paymentName}`,
                    html : buildEmail(user.name || "User" , payment , statusText),
                };
                       try {
                        const info = await transporter.sendMail(mailOptions);
                        console.log(`✅ Email sent to ${user.email} for payment: ${payment.paymentName} (${statusText})`);
                        console.log(`📧 Message ID: ${info.messageId}`);
                        emailsSent++;

                    } catch (emailError) {
                        console.error(`❌ Failed to send email to ${user.email}:`, emailError.message);
                        emailsFailed++;
                    }
                
            }
        }
    
    console.log("\n" + "=".repeat(60));
        console.log("📊 DETAILED SUMMARY:");
        console.log(`📧 Total emails sent: ${emailsSent}`);
        console.log(`❌ Total emails failed: ${emailsFailed}`);
    } catch (error) {
        console.error("Error in sending payment remainders:" , error);
    }
};

//Schedule to run once daily at 9:00 AM
cron.schedule("0 9 * * *", () => {
    console.log("Running daily payment reminder job");
    checkPayments();
});

module.exports = { 
    checkPayments, 
    buildEmail 
};