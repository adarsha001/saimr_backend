// middleware/detectWebsite.js
const detectWebsite = (req, res, next) => {
  // If sourceWebsite is already in body, use it
  if (!req.body.sourceWebsite) {
    const referer = req.headers.referer || req.headers.origin || '';
    
    if (referer.includes('saimgroups')) {
      req.body.sourceWebsite = 'saimgroups';
    } else if (referer.includes('cleartitle1')) {
      req.body.sourceWebsite = 'cleartitle1';
    } else {
      req.body.sourceWebsite = 'direct';
    }
  }
  
  next();
};

module.exports = detectWebsite;