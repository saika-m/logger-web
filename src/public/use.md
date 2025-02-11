# Link them in your HTML:

```html
<link rel="stylesheet" href="/public/css/dashboard.css">
<script src="/public/js/bundle.js"></script>
```

# Make sure to serve them statically in your Express app:

```javascript
javascriptCopyapp.use('/public', express.static('public'));
```