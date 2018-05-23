let express = require('express');
let router = express.Router();
let bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: true }));
let db = require('../DBfunctions');
let matchingStudent = require('./match');
let matchingCompany = require('./companyMatch');


let bcrypt = require('bcrypt');
let mysql = require('mysql');
let fs = require("fs");

let sort_test;

let con = mysql.createConnection({
    host: "83.255.197.121",
    user: "joakim",
    password: "joakim97",
    port: "3306",
    database: "webslingers"
});

router.get('/', (req, res) => {
    if (req.session.user) {
        db.getuname(req.session.user, function (err, result) {
            if (err) throw err;
            res.redirect('/profile');
            console.log('user', req.session.orgnr);
            console.log('exid', req.session.exid);
        });
    }
    else
        res.render('index');
});
router.post('/register', (req, res) => {
    var username = req.body.username,
        password = req.body.password,
        role = req.body.role,
        pnum = req.body.pnum;

    bcrypt.hash(req.body.password, 10, function (err, hash) {
        if (err) throw err;

        db.insert_user(username, hash, role, function (err, result) {
            if (err) {
                req.flash('danger', 'User already exists. Please choose another username and try again.')
                res.redirect('/');
            }
            else if (role === "student" && !err) {
                db.insert_student(username, pnum, function (err, result) {
                    if (err) throw err;
                    req.flash('success', 'You have successfully registered your account.');
                    res.redirect('/');
                })
            }
            else if (role === "company" && !err) {
                db.insert_company(username, pnum, function (err, result) {
                    if (err) throw err;
                    req.flash('success', 'You have successfully registered your account.');
                    res.redirect('/');
                })
            }
        })
    })
});

router.get('/login', function (req, res) {
    if (req.session.user) {
        db.getuname(req.session.user, function (err, result) {
            if (err) throw err;
            res.redirect('/profile');
        });
    }
    else
        res.render('index')
});
router.post('/login', function (req, res) {
    var username = req.body.username,
        password = req.body.password;
    var sql = "SELECT * FROM users WHERE ID = ?";
    con.query(sql, username, function (err, results) {
        if (err) throw err;
        if (results.length == 0) {
            req.flash('danger', 'Invalid username or password');
            res.redirect('/');
        }
        else {
            bcrypt.compare(password, results[0].Password, function (err, match) {
                if (match) {
                    if (req.body.remember)
                        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 365 * 100;
                    else
                        req.session.cookie.expires = null;
                    req.session.user = username;
                    req.session.role = results[0].Role;
                    req.flash('success', 'You have successfully logged in');
                    res.redirect('/profile');
                    if (req.session.role === 'student') 
                        matchingStudent.prematching(req.session.user);
                    else if (req.session.role === 'company')
                        matchingCompany.companyPrematching(req.session.user);
                }
                else {
                    req.flash('danger', 'Invalid username or password');
                    res.redirect('/');
                }
            });
        }
    });
});
router.get('/profile', (req, res) => {
    if (req.session.user && req.session.role == 'student') {
        db.get_student_user_and_nr(req.session.user, function (err, result) {
            if (err) throw err;
            req.session.pnr = result[0].pnr;
            req.session.student = result;
        });
        db.get_student_qualifications(req.session.user, function (err, results) {
            if (err) throw err;
            req.session.get_student_qual = results
        });
        db.get_workexp(req.session.user, function (err, results) {
            if (err) throw err;
            req.session.get_workexp = results;
        })
        db.get_education(req.session.user, function(err, results){
            if (err) throw err;
            req.session.get_education = results
        })
        db.get_qualifications(function (err, results) {
            if (err) 
                console.log("err: " + err)
            req.session.qual_list = results;
            res.render('StudentProfile', {
                results: results,
                student_user_and_nr: req.session.student,
                get_student_qual: req.session.get_student_qual,
                get_workexp: req.session.get_workexp,
                get_education: req.session.get_education
            });
        })
    }
    else if (req.session.user && req.session.role == 'company') {
        db.get_company_user_and_nr(req.session.user, function (err, result) {
            if (err) throw err
            else {
                req.session.orgnr = result[0].Orgnr;
                req.session.company = result;
            }
        });
        db.get_qualifications(function (err, results) {
            if (err)
                console.log("err: " + err)
            req.session.qual_list = results;
        });
        db.get_exjobs(req.session.user, function (err, results) {
            if (err) throw err
            else {
                req.session.getData = results;
                req.session.exid = results;
            }
        });
        db.get_demanded_qual(req.body.job_id, function (err, results) {
            if (err)
                console.log("err: " + err)
            req.session.quals = results;
            res.render('companyProfile', {
                get_exjobs: req.session.exid,
                exjobs: req.session.getData,
                get_company_user_and_nr: req.session.company,
                qual_list: req.session.qual_list,
                quals: req.session.quals
            })
        });
    }
    else
        res.redirect('/')
});
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

router.post('/change_student_profile', function (req, res) {
    var uname = req.body.username,
        name = req.body.name,
        pnr = req.body.pnum,
        gender = req.body.gender,
        tel = req.body.tel,
        adress = req.body.address;

    bcrypt.hash(req.body.password, 10, function (err, hash) {
        if (err) throw err;
        db.update_user(req.session.user, hash, function (err, result) {
            if (err) {
                req.flash('danger', 'An error has occured while updating');
                res.redirect('/profile');
            }
            else if (!err) {
                db.update_studentprofile(req.session.pnr, req.session.user, name, gender, adress, tel, function (err, result) {
                    if (err) {
                        req.flash('danger', 'An error has occured while updating');
                        res.redirect('/profile');
                    }
                    else {
                        req.flash('success', 'You have succcessfully updated your profile');
                        res.redirect('/profile');
                    }
                })
            }
        })
    })
});

router.post('/change_company_profile', function (req, res) {
    var uname = req.body.username,
        password = req.body.password,
        name = req.body.name,
        pnr = req.body.pnum,
        gender = req.body.gender,
        tel = req.body.tel,
        adress = req.body.address;
    bcrypt.hash(req.body.password, 10, function (err, hash) {
        if (err) throw err;
        db.update_company(req.session.user, hash, function (err, result) {
            if (err) {
                req.flash('danger', 'An error has occured while updating');
                res.redirect('/profile');
            }
            else if (!err) {
                db.update_companyprofile(req.session.orgnr, req.session.user, name, adress, tel, function (err, result) {
                    if (err) {
                        req.flash('danger', 'An error has occured while updating');
                        res.redirect('/profile');
                    }
                    else {
                        req.flash('success', 'You have succcessfully updated your profile');
                        res.redirect('/profile');
                    }
                })
            }
        })
    })
});

// filhantering cv
router.post('/fileupload', (req, res) => {
    //upload(req, res, (err) => {
    //    if(err){
    //        req.flash('danger', "error occured" + err);
    //        res.redirect('/profile');
    //    }
    //    else{
    //        console.log("filetest: ", req.file);
    //    }
    //});
    //if (req.files) {
    //    console.log(req.files);
    //    console.log(req.files.filename.data);
    //    //var file = req.files.filename,
    //    //    filename = file.name;
    //    //    console.log("filnamnet: "+ filename);
    //    //file.mv("../public/upload/"+filename, function(err){
    //    //    if(err){
    //    //        console.log('error occured'+err);
    //    //        req.flash('danger', 'error occured');
    //    //    }
    //    //    else{
    //    //        req.flash('success', 'Done!');
    //    //        res.redirect("/profile");
    //    //    }
    //    //})
    //    //db.update_user_cv(req.session.pnr, req.files.filename.data, function (err, result) {
    //    //    if (err) {
    //    //        req.flash('danger', 'An error has occured while updating');
    //    //        res.redirect('/profile');
    //    //    }
    //    //    else if (!err) {
    //    //        req.flash('success', 'You have succcessfully updated your profile');
    //    //        res.redirect('/profile');
    //    //    }
    //    //})
    //}
});
// skriva ut cv på sidan
router.get('/Certificate', function (req, res) {
    db.get_cv(req.session.pnr, function (err, result) {
        if (err) {
            req.flash('danger', 'An error has occured while loading');
            res.redirect('/profile');
        }
        else if (!err) {
            console.log("result: ", result)
            res.render('Certificate', {
                results: result
            });
        }
    })
})

router.get('/studentMatch', function (req, res) {
    if (req.session.user && req.session.role == 'student') {
        db.get_student_user_and_nr(req.session.user, function (err, result) {
            if (err) throw err;
            req.session.pnr = result[0].pnr;
            req.session.student = result;
        });
        db.get_student_qualifications(req.session.user, function (err, results) {
            if (err) throw err;
            req.session.get_student_qual = results
        });
        db.get_qualifications(function (err, results) {
            if (err)
                console.log("err: " + err)
            req.session.qual_list = results;
            res.render('studentMatch', {
                results: results,
                student_user_and_nr: req.session.student,
                get_student_qual: req.session.get_student_qual,
                matchning: matchingStudent.matcha()
            });
        })
    }
    else
        res.redirect('/')
});

router.post('/forgot', function (req, res) {
    const output = `
    <h3>Your account information</h3>
    <ul>
        <li>Account: ${req.body.email}</li>
        <li>Password: password</li>
    </ul>
    `
    db.getuname(req.body.email, function (err, results) {
        if (err) throw err;
        if (results.length == 0) {
            req.flash('danger', 'No user with this email could be found');
            res.redirect('/');
        }
        else {
            bcrypt.compare(results[0].Password, results[0].Password, function (err, match) {
                if (err) throw err;
                else if (match)
                    bcrypt.hash('password', 10, function (err, hash) {
                        if (err) throw err;
                        db.update_user(req.body.email, hash, function (err, result) {
                            if (err) {
                                req.flash('danger', 'An error has occured while updating');
                                res.redirect('/profile');
                            }
                            else if (!err) {
                                var transporter = nodemailer.createTransport({
                                    service: 'gmail',
                                    auth: {
                                        user: 'customerservice.webslingers@gmail.com',
                                        pass: 'jocketest'
                                    },
                                    tls: {
                                        rejectUnauthorized: false
                                    }
                                });
                                const mailOptions = {
                                    from: "Jocke Le 💩<customerservice.webslingers@hotmail.com>",
                                    to: req.body.email,
                                    subject: 'Password Reset - Webslingers',
                                    html: output
                                    // html: '<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                                    // 'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                                    // 'http://' + /*req.headers.host + */ '/reset/' /*+ token*/ + '\n\n' +
                                    // 'If you did not request this, please ignore this email and your password will remain unchanged.\n</p>'// plain text body

                                };
                                transporter.sendMail(mailOptions, function (err, info) {
                                    if (err) throw err;
                                    else {
                                        req.flash('success', 'An email has been sent to you. Please check your inbox.');
                                        res.redirect('/');
                                    }
                                });
                            }
                        })
                    })
            })
        }
    });
});

router.post('/add_job', function (req, res) {
    db.insert_exjobs(req.session.orgnr, req.body.title, req.body.info, req.body.date, req.body.teaser, function (err, results) {
        if (err) {
            req.flash('danger', 'An error has occured');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have added a new job');
            res.redirect('/profile');
        }
    })
});

router.post('/update_job', function (req, res) {
    db.update_exjob(req.body.name, req.body.info, req.body.date, req.body.teaser, req.body.job_id, function (err, result) {
        if (err) {
            req.flash('danger', 'An error has occured while updating your profile');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully updated a job');
            res.redirect('/profile');
        }
    })
});

router.post('/delete_job', function (req, res) {
    db.delete_exjob(req.body.job_id, function (err, results) {
        if (err) {
            req.flash('danger', 'An error has occured');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully removed a job')
            res.redirect('/profile');
        }
    })
});

router.get('/profileStudentProfile', function (req, res) {
    res.render("pages/profileStudentProfile");
});

router.post('/exjobMatch', function (req, res) { 
    if (req.session.user && req.session.role == 'company') {
        db.get_company_user_and_nr(req.session.user, function (err, result) {
            if (err) throw err
            else {
                req.session.orgnr = result[0].Orgnr;
                req.session.company = result;
            }
        });
        db.get_qualifications(function (err, results) {
            if (err)
                console.log("err: " + err)
            req.session.qual_list = results;
        });
        db.get_exjobs(req.session.user, function (err, results) {
            if (err) throw err
            else
                req.session.exid = results;
        });
        db.get_demanded_qual(req.body.job_id, function (err, results) {
            if (err) {
                console.log("err: " + err)
            }
            req.session.quals = results;
            req.body.job_id;
            res.render('exjobMatch', {
                get_exjobs: req.session.exid,
                get_company_user_and_nr: req.session.company,
                qual_list: req.session.qual_list,
                quals: req.session.quals,
                matchning: matchingCompany.companyMatcha(req.body.job_id)
            })
        });
    }
    else
        res.redirect('/')
});

router.post('/change_skill_student', function (req, res) {
    db.insert_studentqual(req.session.pnr, req.body.student_qual, function (err, results) {
        if (err) {
            req.flash('danger', 'The qualification already exists on this user');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully added a qualification');
            res.redirect('/profile');
        }
    })
});

router.post('/update_skill_xjob', function (req, res) {
    db.insert_xjob_qual(req.body.job_id, req.body.xjob_qual, function (err, results) {
        if (err) {
            req.flash('danger', 'The qualification already exists on this user');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have successfully added a qualification');
            res.redirect('/profile');
        }
    })
});

router.post('/add_workexp', function (req, res) {
    db.insert_workexp(req.session.user, req.body.title, req.body.date, req.body.info, function (err, results) {
        if (err)
            console.log('error while adding experience', err);
        else
            res.redirect('/profile');
    })
});

router.post('/update_workexp', function (req, res) {
    db.update_workexp(req.body.name, req.body.date, req.body.info, req.body.work_id, function (err, results) {
        if (err){
            req.flash('danger', 'Error while updating work experience');
            res.redirect('/profile');
        }
        else{
            req.flash('success', 'You have updated a work experience');
            res.redirect('/profile');
        }
    })
});

router.post('/delete_workexp', function (req, res) {
    db.delete_workexp(req.body.work_id, function (err, results) {
        if (err) throw err;
        else {
            req.flash('success', 'You have deleted a work experience');
            res.redirect('/profile');
        }
    })
});

router.post('/add_education', function (req, res) {
    db.insert_education(req.session.user, req.body.title, req.body.date, req.body.info, function (err, results) {
        if (err) {
            req.flash('danger', 'An error has occured while adding a new education');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have added a new education')
            res.redirect('/profile');
        }
    })
});

router.post('/delete_education', function (req, res) {
    db.delete_education(req.body.education_id, function (err, results) {
        if (err) {
            req.flash('danger', 'An error has occured');
            res.redirect('/profile');
        }
        else {
            req.flash('success', 'You have deleted a education experience');
            res.redirect('/profile');
        }
    })
});

router.post('/update_education', function (req, res) {
    db.update_education(req.body.name, req.body.date, req.body.info, req.body.education_id, function (err, results) {
        if (err){
            req.flash('danger', 'Error while updating education experience');
            res.redirect('/profile');
        }
        else{
            req.flash('success', 'You have updated a education experience');
            res.redirect('/profile');
        }
    })
});

module.exports = router;