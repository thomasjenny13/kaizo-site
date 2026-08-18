console.log("JS chargé !");
const logo = document.getElementById("logo");
const pieces = document.getElementById("pieces");

logo.addEventListener("click", ()=>{

    gsap.to("body",{
        backgroundColor:"#ffffff",
        duration:.5
    });

    gsap.to(logo,{
        opacity:0,
        scale:1.6,
        duration:.35,
        onComplete:()=>{

            logo.style.display="none";

            pieces.style.opacity=1;

            gsap.fromTo("#pieces",
                {scale:1.6},
                {scale:1.8,duration:.5}
            );

            gsap.to("#left",{
                x:-350,
                duration:1.2,
                ease:"power4.out"
            });

            gsap.to("#right",{
                x:350,
                duration:1.2,
                ease:"power4.out"
            });

            gsap.to("#top",{
                y:-250,
                duration:1.2,
                ease:"power4.out"
            });

            gsap.to("#bottom",{
                y:250,
                duration:1.2,
                ease:"power4.out"
            });

        }

    });

});