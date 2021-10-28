<?php

if($_POST['country']){
  $file_name = 'country.txt';

  $time = $_POST['country'];
  //opens the file.txt file or implicitly creates the file
  $myfile = fopen($file_name, 'a+') or die('Cannot open file: '.$file_name);
  // write name to the file
  fwrite($myfile, $time."\n");
  // close the file
  fclose($myfile);
}

?>
