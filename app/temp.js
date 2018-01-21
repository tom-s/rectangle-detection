
      var image = new Image()
      image.onload = function(){
        var canvas = document.createElement('canvas')
        var w = canvas.width = image.width
        var h = canvas.height = image.height
        var ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0, image.width, image.height)
        document.body.appendChild(canvas)
        var data = ctx.getImageData(0,0,w,h)

        // invert & threshold
        for (var i = 0; i < data.data.length; i+=4) {
          var m = data.data[i] > 128 ? 0 : 255
          data.data[i] = m
          data.data[i+1] = m
          data.data[i+2] = m
          data.data[i+3] = 255
        }

        // ctx.putImageData(data,0,0)
        ctx.clearRect(0,0,w,h)

        window.data = data

        console.time('contours')
        window.result = contours(data)
        console.timeEnd('contours')

        console.log(window.result)
        console.log(window.result.length)


        ctx.lineWidth = 1.5

        window.result.forEach(function(c,i) {

          setTimeout(function(){

            ctx.beginPath()
            ctx.strokeStyle = 'hsl('+~~(Math.random()*360)+', 50%, 50%)'
            c.forEach(function(p){{
              ctx.lineTo(
                p % w,
                Math.floor(p/w)
              )
            }})
            ctx.stroke()

          }, i * 100)

        })

      }
      image.src = 'example.jpg'
